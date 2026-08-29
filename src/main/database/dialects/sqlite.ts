import queries from '@main/database/queries/sqlite';
import type { DatabaseDialectAdapter, SerializedRunSqlResult } from '../types';

const quoteIdentifier = (value: string) => `"${String(value).replace(/"/g, '""')}"`;

const splitStatements = (sql: string) => {
  const statements: string[] = [];
  let current = '';
  let quote: false | 'single' | 'double' | 'backtick' = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const nextChar = sql[index + 1];

    if (lineComment) {
      current += char;
      if (char === '\n') lineComment = false;
      continue;
    }

    if (blockComment) {
      current += char;
      if (char === '*' && nextChar === '/') {
        current += nextChar;
        index += 1;
        blockComment = false;
      }
      continue;
    }

    if (!quote && char === '-' && nextChar === '-') {
      current += char;
      current += nextChar;
      index += 1;
      lineComment = true;
      continue;
    }

    if (!quote && char === '/' && nextChar === '*') {
      current += char;
      current += nextChar;
      index += 1;
      blockComment = true;
      continue;
    }

    if (!quote && char === "'") {
      quote = 'single';
      current += char;
      continue;
    }

    if (!quote && char === '"') {
      quote = 'double';
      current += char;
      continue;
    }

    if (!quote && char === '`') {
      quote = 'backtick';
      current += char;
      continue;
    }

    if (quote === 'single' && char === "'") {
      if (nextChar === "'") {
        current += char;
        current += nextChar;
        index += 1;
        continue;
      }
      quote = false;
    }

    if (quote === 'double' && char === '"') {
      if (nextChar === '"') {
        current += char;
        current += nextChar;
        index += 1;
        continue;
      }
      quote = false;
    }

    if (quote === 'backtick' && char === '`') quote = false;

    if (!quote && char === ';') {
      const statement = current.trim();
      if (statement) statements.push(statement);
      current = '';
      continue;
    }

    current += char;
  }

  const statement = current.trim();
  if (statement) statements.push(statement);

  return statements;
};

const normalizeRows = (rows: any[]) => {
  return rows.map((row) => {
    const normalized = { ...row };

    for (const field of ['column_names', 'column_orders']) {
      if (typeof normalized[field] === 'string') {
        normalized[field] = normalized[field].split(',').filter(Boolean);
      }
    }

    return normalized;
  });
};

const getRows = (raw: any) => {
  const rows = Array.isArray(raw) ? raw : raw?.rows || [];

  if (!Array.isArray(rows)) return [];

  return normalizeRows(rows);
};

const isSelectStatement = (statement?: string) => {
  const normalized = statement?.trim().replace(/\s+/g, ' ').toLowerCase() || '';
  return (
    normalized.startsWith('select') ||
    normalized.startsWith('with') ||
    normalized.startsWith('pragma')
  );
};

const normalizeSqlIdentifier = (value: string) => {
  return value
    ?.split('.')
    .map((part) =>
      part
        .replace(/^[`"\[]|[`"\]]$/g, '')
        .replace(/``/g, '`')
        .replace(/""/g, '"'),
    )
    .join('.');
};

const reservedWordsToIgnoreAlias = [
  'where',
  'full',
  'inner',
  'left',
  'right',
  'on',
  'limit',
  'order by',
  'group by',
  'having',
].join('|');

const getTablesFromQuerySql = (sql: string) => {
  const regex = new RegExp(
    `(?:FROM|JOIN)\\s+([\\w.\`"\\[\\]]+)\\s*(?!${reservedWordsToIgnoreAlias})(?:AS\\s+(\\w+)|(\\w+))?`,
    'gim',
  );
  const tables = new Map<string, { name: string; schema?: string }>();
  let match: RegExpExecArray | null;

  while ((match = regex.exec(sql))) {
    const sqlTablePart = normalizeSqlIdentifier(match[1]);
    const [schema, name] = sqlTablePart.includes('.')
      ? sqlTablePart.split('.')
      : [undefined, sqlTablePart];

    if (!name) continue;

    tables.set(`${schema ? schema + '.' : ''}${name}`, { name, schema });
  }

  return [...tables.values()];
};

const hasMissingColumnsInfo = (result: SerializedRunSqlResult) => {
  const columnsInfo = new Map(result.columns_info?.map((column) => [column.name, column.type]));

  return result.columns.some((column) => !columnsInfo.get(column));
};

const sqlite: DatabaseDialectAdapter = {
  id: 'sqlite',
  client: 'sqlite3',
  queries,
  quoteIdentifier,
  getConnectionConfig: ({ database }) => ({
    filename: database,
  }),
  getKnexConfig: () => ({
    useNullAsDefault: true,
    pool: { min: 1, max: 1 },
  }),
  getRows,
  splitStatements,
  getExplainSql: (sql) => `EXPLAIN QUERY PLAN ${sql};`,
  serializeRunSqlResult: (raw, context) => {
    const rows = getRows(raw);
    const type = isSelectStatement(context.statement) ? 'SELECT' : 'OK';
    const columns = Object.keys(rows[0] || {});

    return [
      {
        type,
        auto_paginated: context.auto_paginated,
        execution_time_ms: context.execution_time_ms,
        rows: JSON.parse(JSON.stringify(rows)),
        columns,
      } satisfies SerializedRunSqlResult,
    ];
  },
  resolveRunSqlColumnsInfo: async ({ instance, dbConnection, sql, results }) => {
    if (!results.some(hasMissingColumnsInfo)) return results;

    const tables = getTablesFromQuerySql(sql);
    if (!tables.length) return results;

    try {
      const tablesColumns = await Promise.all(
        tables.map(async (table) => {
          const raw = await instance.raw(queries.getTableColumns({ table: table.name })).connection(
            dbConnection,
          );

          return getRows(raw);
        }),
      );
      const typesByColumn = new Map<string, Set<string>>();

      tablesColumns.flat().forEach((column) => {
        const types = typesByColumn.get(column.column_name) ?? new Set<string>();
        if (column.data_type) types.add(column.data_type);
        typesByColumn.set(column.column_name, types);
      });

      return results.map((result) => {
        if (!hasMissingColumnsInfo(result)) return result;

        const currentColumnsInfo = new Map(
          result.columns_info?.map((column) => [column.name, column.type]),
        );
        const columns_info = result.columns.map((column) => {
          const currentType = currentColumnsInfo.get(column);
          if (currentType) return { name: column, type: currentType };

          const types = typesByColumn.get(column);
          return { name: column, type: types?.size === 1 ? [...types][0] : undefined };
        });

        return { ...result, columns_info };
      });
    } catch {
      return results;
    }
  },
};

export default sqlite;
