import type { FieldPacket, ResultSetHeader } from 'mysql2';
import { quoteMysqlIdentifier as quoteIdentifier } from '@shared/utils/sql';
import type { DatabaseRow, SerializedRunSqlResult } from '@shared/types/database';
import queries from '../queries/mysql';
import type { DatabaseDialectAdapter } from '../types';

const splitStatements = (sql: string) => {
  const statements: string[] = [];
  let current = '';
  let quote: false | 'single' | 'double' | 'backtick' = false;
  let lineComment = false;
  let blockComment = false;

  for (let index = 0; index < sql.length; index += 1) {
    const char = sql[index];
    const nextChar = sql[index + 1];
    const previousChar = sql[index - 1];

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

    if (quote === 'single' && char === "'" && previousChar !== '\\') quote = false;
    if (quote === 'double' && char === '"' && previousChar !== '\\') quote = false;
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

const normalizeRows = (rows: DatabaseRow[]) => {
  return rows.map((row) => {
    const normalized = { ...row };

    for (const field of ['column_names', 'column_orders']) {
      const value = normalized[field];
      if (typeof value !== 'string') continue;

      try {
        normalized[field] = JSON.parse(value);
      } catch {
        normalized[field] = value.split(',').filter(Boolean);
      }
    }

    if (normalized['Create Table'] && !normalized.definition) {
      normalized.definition = normalized['Create Table'];
    }

    if (normalized['Create View'] && !normalized.definition) {
      normalized.definition = normalized['Create View'];
    }

    return normalized;
  });
};

const getRows = <Row = DatabaseRow>(raw: unknown): Row[] => {
  const rows = Array.isArray(raw) ? raw[0] : (raw as { rows?: DatabaseRow[] })?.rows || [];

  if (!Array.isArray(rows)) return [];

  return normalizeRows(rows) as Row[];
};

const getMysqlTypeName = (field: FieldPacket & { extendedTypeName?: string; typeName?: string }) => {
  if (field.extendedTypeName) return String(field.extendedTypeName).toLowerCase();
  if (field.typeName) return String(field.typeName).toLowerCase();

  return undefined;
};

const mysql: DatabaseDialectAdapter = {
  id: 'mysql',
  client: 'mysql2',
  queries,
  // Fail closed for case-variant self-joins on any lower_case_table_names mode.
  queryIdentifierRules: { caseInsensitive: true },
  quoteIdentifier,
  getConnectionConfig: (config) => ({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    dateStrings: true,
    flags: ['FOUND_ROWS'],
  }),
  getRows,
  splitStatements,
  getExplainSql: (sql) => `EXPLAIN ANALYZE ${sql};`,
  executeQueryUpdate: async (transaction, sql, bindings) => {
    const results: ResultSetHeader[] = await transaction.raw(sql, bindings);
    return results[0]?.affectedRows ?? NaN;
  },
  validateQueryUpdateTable: async (transaction, { schema, table }) => {
    const info = await transaction('information_schema.TABLES as t')
      .join('information_schema.ENGINES as e', 'e.ENGINE', 't.ENGINE')
      .select('e.TRANSACTIONS as transactions')
      .where('t.TABLE_NAME', table)
      .where('t.TABLE_TYPE', 'BASE TABLE')
      .whereRaw('t.TABLE_SCHEMA = COALESCE(?, DATABASE())', [schema ?? null])
      .first();
    if (info?.transactions !== 'YES') {
      throw new Error(`A tabela "${table}" não suporta o salvamento transacional dessas alterações.`);
    }
  },
  serializeRunSqlResult: (raw, context) => {
    const rows = getRows(raw);
    const fields: FieldPacket[] | undefined = Array.isArray(raw) ? raw[1] : undefined;
    const okPacket: ResultSetHeader | undefined = Array.isArray(raw) && !Array.isArray(raw[0]) ? raw[0] : undefined;
    const columns = fields?.map?.((field) => field.name) || Object.keys(rows[0] || {});
    const type = rows.length || Array.isArray(raw?.[0]) ? 'SELECT' : 'OK';

    return [
      {
        type,
        affected_rows: okPacket?.affectedRows,
        auto_paginated: context.auto_paginated,
        execution_time_ms: context.execution_time_ms,
        rows: JSON.parse(JSON.stringify(rows)),
        columns,
        columns_info: fields?.map?.((field) => ({
          name: field.name,
          type: getMysqlTypeName(field),
          source: field.orgTable && field.orgName
            ? { schema: field.schema || field.db, table: field.orgTable, column: field.orgName }
            : undefined,
        })),
        column_sources_resolved: true,
      } satisfies SerializedRunSqlResult,
    ];
  },
};

export default mysql;
