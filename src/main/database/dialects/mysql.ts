import queries from '../querys/mysql';
import type { DatabaseDialectAdapter, SerializedRunSqlResult } from './types';

const quoteIdentifier = (value: string) => `\`${String(value).replace(/`/g, '``')}\``;


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

const normalizeRows = (rows: any[]) => {
  return rows.map((row) => {
    const normalized = { ...row };

    if (typeof normalized.column_names === 'string') {
      try {
        normalized.column_names = JSON.parse(normalized.column_names);
      } catch {
        normalized.column_names = normalized.column_names.split(',').filter(Boolean);
      }
    }

    if (normalized['Create Table'] && !normalized.definition) {
      normalized.definition = normalized['Create Table'];
    }

    return normalized;
  });
};

const getRows = (raw: any) => {
  const rows = Array.isArray(raw) ? raw[0] : raw?.rows || [];

  if (!Array.isArray(rows)) return [];

  return normalizeRows(rows);
};

const mysql: DatabaseDialectAdapter = {
  id: 'mysql',
  client: 'mysql2',
  queries,
  quoteIdentifier,
  getConnectionConfig: ({ database, host, port, username: user, password }) => ({
    host,
    port,
    user,
    password,
    database,
    dateStrings: true,
  }),
  getRows,
  splitStatements,
  serializeRunSqlResult: (raw, context) => {
    const rows = getRows(raw);
    const fields = Array.isArray(raw) ? raw[1] : undefined;
    const okPacket = Array.isArray(raw) && !Array.isArray(raw[0]) ? raw[0] : undefined;
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
      } satisfies SerializedRunSqlResult,
    ];
  },
};

export default mysql;
