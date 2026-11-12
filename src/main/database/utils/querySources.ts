import type { SerializedRunSqlResult } from '@shared/types/database';
import { isQueryUpdateIdentifier } from './queryUpdates';

type SqlToken = {
  value: string;
  kind: 'word' | 'identifier' | 'literal' | 'symbol';
  unquotedValue?: string;
};

export interface QueryIdentifierRules {
  foldUnquoted?: boolean;
  caseInsensitive?: boolean;
}

const sameIdentifier = (left: string, right: string, rules: QueryIdentifierRules) =>
  rules.caseInsensitive ? left.toLowerCase() === right.toLowerCase() : left === right;

// This deliberately recognizes only flat SELECTs, not arbitrary SQL. Native
// origins are still required; this check can only remove editability, never infer it.
const tokenize = (sql: string): SqlToken[] | undefined => {
  const tokens: SqlToken[] = [];
  let index = 0;
  while (index < sql.length) {
    const rest = sql.slice(index);
    const space = /^\s+/.exec(rest);
    if (space) {
      index += space[0].length;
      continue;
    }
    if (rest.startsWith('--')) {
      if (rest.length > 2 && !/\s/.test(rest[2])) return;
      const end = sql.indexOf('\n', index + 2);
      index = end < 0 ? sql.length : end + 1;
      continue;
    }
    if (rest.startsWith('/*')) {
      const end = sql.indexOf('*/', index + 2);
      if (end < 0 || sql.slice(index + 2, end).includes('/*') || rest.startsWith('/*!')) return;
      index = end + 2;
      continue;
    }
    const quote = sql[index];
    if (quote === '"' || quote === '`' || quote === "'") {
      let value = '';
      index += 1;
      let closed = false;
      while (index < sql.length) {
        if (sql[index] === '\\') return; // Dialect-dependent escaping: fail closed.
        if (sql[index] === quote) {
          if (sql[index + 1] === quote) {
            value += quote;
            index += 2;
            continue;
          }
          index += 1;
          closed = true;
          break;
        }
        value += sql[index++];
      }
      if (!closed) return;
      tokens.push({ value, kind: quote === "'" ? 'literal' : 'identifier' });
      continue;
    }
    const word = /^[a-z_][a-z0-9_$]*/i.exec(rest);
    if (word) {
      tokens.push({ value: word[0].toLowerCase(), kind: 'word', unquotedValue: word[0] });
      index += word[0].length;
      continue;
    }
    if (quote === '$' || quote === '#' || quote === '[' || quote === '\\') return;
    tokens.push({ value: quote, kind: 'symbol' });
    index += 1;
  }
  return tokens;
};

const clauseWords = new Set(['where', 'order', 'limit', 'offset', 'fetch']);
const joinWords = new Set(['join', 'inner', 'left', 'right', 'full', 'outer', 'cross', 'natural']);
const identifier = (token?: SqlToken) =>
  token && (token.kind === 'identifier' || token.kind === 'word');
const keyword = (token: SqlToken | undefined, word: string) =>
  token?.kind === 'word' && token.value === word;
const isClause = (token?: SqlToken) => token?.kind === 'word' && clauseWords.has(token.value);
const isJoin = (token?: SqlToken) => token?.kind === 'word' && joinWords.has(token.value);

export const getFlatSelectTables = (
  sql: string,
  rules: QueryIdentifierRules = { foldUnquoted: true },
) => {
  const tokens = tokenize(sql);
  if (!tokens || !keyword(tokens[0], 'select')) return;
  if (tokens.at(-1)?.value === ';') tokens.pop();
  const forbidden = new Set([
    'select',
    'with',
    'distinct',
    'group',
    'having',
    'union',
    'intersect',
    'except',
    'over',
    'into',
    'for',
    'window',
    'qualify',
  ]);
  if (
    tokens
      .slice(1)
      .some((token) => token.value === ';' || (token.kind === 'word' && forbidden.has(token.value)))
  )
    return;
  const from = tokens.findIndex((token) => keyword(token, 'from'));
  if (from < 2 || tokens.slice(1, from).some((token) => token.value === '(')) return;

  const tables: { table: string; schema?: string }[] = [];
  const identifierValue = (token: SqlToken) =>
    token.kind === 'word' && !rules.foldUnquoted ? token.unquotedValue! : token.value;
  let index = from + 1;
  const readTable = () => {
    if (!identifier(tokens[index])) return false;
    let table = identifierValue(tokens[index++]);
    let schema: string | undefined;
    if (tokens[index]?.value === '.') {
      index += 1;
      if (!identifier(tokens[index])) return false;
      schema = table;
      table = identifierValue(tokens[index++]);
    }
    tables.push({ table, schema });
    if (keyword(tokens[index], 'as')) {
      index += 1;
      if (!identifier(tokens[index])) return false;
      index += 1;
    } else if (
      identifier(tokens[index]) &&
      !isJoin(tokens[index]) &&
      !isClause(tokens[index]) &&
      !keyword(tokens[index], 'on')
    ) {
      index += 1;
    }
    return true;
  };
  if (!readTable()) return;
  while (index < tokens.length && !isClause(tokens[index])) {
    if (!isJoin(tokens[index])) return;
    while (isJoin(tokens[index]) && !keyword(tokens[index], 'join')) index += 1;
    if (!keyword(tokens[index], 'join')) return;
    index += 1;
    if (!readTable()) return;
    if (keyword(tokens[index], 'on')) {
      index += 1;
      while (
        index < tokens.length &&
        (tokens[index - 1]?.value === '.' || (!isJoin(tokens[index]) && !isClause(tokens[index])))
      ) {
        if (tokens[index].value === '(' || tokens[index].value === ',') return;
        index += 1;
      }
    }
  }
  // An unqualified occurrence may resolve to any matching schema. Reject it
  // together with a second occurrence rather than pairing the wrong PK aliases.
  if (
    tables.some((table, i) =>
      tables.some(
        (other, j) =>
          i !== j &&
          sameIdentifier(table.table, other.table, rules) &&
          (!table.schema || !other.schema || sameIdentifier(table.schema, other.schema, rules)),
      ),
    )
  )
    return;
  return tables;
};

const hasDirectProjection = (sql: string, result: SerializedRunSqlResult) => {
  const tokens = tokenize(sql);
  if (!tokens) return false;
  const from = tokens.findIndex((token) => keyword(token, 'from'));
  const projections: SqlToken[][] = [[]];
  for (const token of tokens.slice(1, from)) {
    if (token.kind === 'symbol' && token.value === ',') projections.push([]);
    else projections.at(-1)?.push(token);
  }
  const literalKeywords = new Set([
    'null',
    'true',
    'false',
    'current_user',
    'session_user',
    'system_user',
    'current_date',
    'current_time',
    'current_timestamp',
    'localtime',
    'localtimestamp',
  ]);
  if (
    projections.some(
      (projection) =>
        projection.length === 1 &&
        projection[0].kind === 'word' &&
        literalKeywords.has(projection[0].value),
    )
  )
    return false;
  if (
    projections.some(
      (projection) =>
        !projection.length ||
        projection.some((token, index) =>
          index % 2 === 0
            ? !identifier(token) && !(token.kind === 'symbol' && token.value === '*')
            : token.kind !== 'symbol' || token.value !== '.',
        ) ||
        projection.length % 2 === 0,
    )
  )
    return false;
  if (
    result.column_sources_resolved &&
    result.columns_info?.some((column) => !column.source && !column.source_ref)
  )
    return false;
  if (projections.some((projection) => projection.at(-1)?.value === '*')) return true;
  return (
    projections.length === result.columns.length &&
    projections.every(
      (projection, index) =>
        projection.at(-1)?.value.toLowerCase() === result.columns[index].toLowerCase(),
    )
  );
};

export const restrictQueryColumnSources = (
  sql: string,
  result: SerializedRunSqlResult,
  rules: QueryIdentifierRules = { foldUnquoted: true },
): SerializedRunSqlResult => {
  const tables = getFlatSelectTables(sql, rules);
  const uniqueNames = new Set(result.columns).size === result.columns.length;
  const columns_info = result.columns_info?.map((column) => {
    const source = column.source;
    return {
      ...column,
      source:
        uniqueNames &&
        tables &&
        source &&
        [source.schema, source.table, source.column].every(
          (name) => name === undefined || isQueryUpdateIdentifier(name),
        ) &&
        tables.some(
          (table) =>
            sameIdentifier(table.table, source.table, rules) &&
            (!table.schema ||
              (source.schema !== undefined && sameIdentifier(table.schema, source.schema, rules))),
        )
          ? source
          : undefined,
    };
  });
  const supportsRowManagement =
    tables?.length === 1 &&
    !!columns_info?.length &&
    columns_info.length === result.columns.length &&
    uniqueNames &&
    !result.columns_info?.some((column, index) => column.source && !columns_info[index].source) &&
    tables.every(
      (table) =>
        isQueryUpdateIdentifier(table.table) &&
        (table.schema === undefined || isQueryUpdateIdentifier(table.schema)),
    ) &&
    hasDirectProjection(sql, result);
  const directSource = columns_info?.[0]?.source;
  return {
    ...result,
    columns_info,
    supports_row_management: supportsRowManagement,
    row_management_table: supportsRowManagement
      ? {
          table: directSource?.table || tables[0].table,
          schema: directSource?.schema || tables[0].schema,
        }
      : undefined,
  };
};
