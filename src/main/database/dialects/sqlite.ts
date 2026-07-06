import queries from '../querys/sqlite';
import type { DatabaseDialectAdapter, SerializedRunSqlResult } from './types';

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

    if (typeof normalized.column_names === 'string') {
      normalized.column_names = normalized.column_names.split(',').filter(Boolean);
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
};

export default sqlite;
