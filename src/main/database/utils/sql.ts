export const sanitizeAutoPaginatedError = (
  error: unknown,
  executableSql: string,
  originalSql: string,
) => {
  if (!(error instanceof Error)) return error;

  const queryError = error as Error & { sql?: string; position?: string };

  queryError.message = sanitizeAutoPaginatedText(queryError.message, executableSql, originalSql);
  queryError.position = sanitizeAutoPaginatedPosition(
    queryError.position,
    executableSql,
    originalSql,
  );

  if (typeof queryError.sql === 'string') {
    queryError.sql = queryError.sql.includes('__base_query')
      ? originalSql
      : queryError.sql.replace(executableSql, originalSql);
  }

  if (typeof queryError.stack === 'string') {
    queryError.stack = queryError.stack.replace(executableSql, originalSql);
  }

  return queryError;
};

const sanitizeAutoPaginatedText = (text: string, executableSql: string, originalSql: string) => {
  const sanitizedText = text.replace(executableSql, originalSql);

  if (!sanitizedText.includes('__base_query')) return sanitizedText;

  return sanitizedText.split(' - ').slice(1).join(' - ') || sanitizedText;
};

const sanitizeAutoPaginatedPosition = (
  position: string | undefined,
  executableSql: string,
  originalSql: string,
) => {
  const numericPosition = Number(position);

  if (!Number.isFinite(numericPosition)) return position;

  const originalSqlStart = executableSql.indexOf(originalSql);
  const originalSqlEnd = originalSqlStart + originalSql.length;

  if (originalSqlStart < 0) return position;
  if (numericPosition <= originalSqlStart || numericPosition > originalSqlEnd) return undefined;

  return String(numericPosition - originalSqlStart);
};

export const normalizeSqlForKeywordSearch = (sql: string) => {
  return sql
    .trim()
    .replace(/;+\s*$/, '')
    .replace(/\s+/g, ' ')
    .toLowerCase();
};

export const isReadOnlySelectQuery = (sql: string) => {
  const statement = sql.trim().replace(/;+\s*$/, '');
  const firstKeyword = readNextSqlKeyword(statement, 0);

  if (firstKeyword?.keyword === 'select') return true;
  if (firstKeyword?.keyword !== 'with') return false;

  const withInfo = readWithQueryInfo(statement, firstKeyword.endIndex);

  return withInfo.finalKeyword === 'select' && !withInfo.hasDataModifyingCte;
};

const readWithQueryInfo = (sql: string, startIndex: number) => {
  let index = startIndex;
  let hasDataModifyingCte = false;
  const recursiveKeyword = readNextSqlKeyword(sql, index);

  if (recursiveKeyword?.keyword === 'recursive') index = recursiveKeyword.endIndex;

  while (index < sql.length) {
    const asKeywordIndex = findTopLevelSqlKeyword(sql, index, ['as']);
    if (asKeywordIndex < 0) break;

    index = asKeywordIndex + 2;

    const bodyStartIndex = findNextSqlChar(sql, index, '(');
    if (bodyStartIndex < 0) break;

    const bodyEndIndex = findMatchingSqlParenthesis(sql, bodyStartIndex);
    if (bodyEndIndex < 0) break;

    const bodySql = sql.slice(bodyStartIndex + 1, bodyEndIndex);
    const bodyKeyword = readNextSqlKeyword(bodySql, 0)?.keyword;

    if (
      isDataModifyingSqlKeyword(bodyKeyword) ||
      (bodyKeyword === 'with' && !isReadOnlySelectQuery(bodySql))
    ) {
      hasDataModifyingCte = true;
    }

    index = skipSqlIgnorable(sql, bodyEndIndex + 1);

    if (sql[index] !== ',') {
      const finalKeyword = readNextSqlKeyword(sql, index)?.keyword;
      return { finalKeyword, hasDataModifyingCte };
    }

    index += 1;
  }

  return { finalKeyword: undefined, hasDataModifyingCte };
};

const isDataModifyingSqlKeyword = (keyword?: string) => {
  return (
    keyword === 'insert' || keyword === 'update' || keyword === 'delete' || keyword === 'merge'
  );
};

const readNextSqlKeyword = (sql: string, startIndex: number) => {
  const index = skipSqlIgnorable(sql, startIndex);
  const match = /^[a-z_][a-z0-9_$]*/i.exec(sql.slice(index));

  if (!match) return undefined;

  return { keyword: match[0].toLowerCase(), endIndex: index + match[0].length };
};

const skipSqlIgnorable = (sql: string, startIndex: number) => {
  let index = startIndex;

  while (index < sql.length) {
    const char = sql[index];

    if (/\s/.test(char)) {
      index += 1;
      continue;
    }

    if (sql.startsWith('--', index)) {
      const lineEndIndex = sql.indexOf('\n', index + 2);
      index = lineEndIndex < 0 ? sql.length : lineEndIndex + 1;
      continue;
    }

    if (sql.startsWith('/*', index)) {
      const commentEndIndex = sql.indexOf('*/', index + 2);
      index = commentEndIndex < 0 ? sql.length : commentEndIndex + 2;
      continue;
    }

    break;
  }

  return index;
};

const findNextSqlChar = (sql: string, startIndex: number, target: string) => {
  let index = startIndex;

  while (index < sql.length) {
    const ignoredEndIndex = skipSqlIgnorable(sql, index);
    if (ignoredEndIndex !== index) {
      index = ignoredEndIndex;
      continue;
    }

    const quotedEndIndex = skipSqlQuotedValue(sql, index);
    if (quotedEndIndex !== index) {
      index = quotedEndIndex;
      continue;
    }

    if (sql[index] === target) return index;

    index += 1;
  }

  return -1;
};

const findTopLevelSqlKeyword = (sql: string, startIndex: number, keywords: string[]) => {
  let index = startIndex;
  let depth = 0;

  while (index < sql.length) {
    const ignoredEndIndex = skipSqlIgnorable(sql, index);
    if (ignoredEndIndex !== index) {
      index = ignoredEndIndex;
      continue;
    }

    const quotedEndIndex = skipSqlQuotedValue(sql, index);
    if (quotedEndIndex !== index) {
      index = quotedEndIndex;
      continue;
    }

    const char = sql[index];

    if (char === '(') depth += 1;
    if (char === ')') depth = Math.max(depth - 1, 0);

    if (depth === 0) {
      const lowerSql = sql.slice(index).toLowerCase();
      const keyword = keywords.find((value) => lowerSql.startsWith(value));

      if (keyword && hasSqlKeywordBoundary(sql, index, keyword.length)) return index;
    }

    index += 1;
  }

  return -1;
};

const findMatchingSqlParenthesis = (sql: string, openIndex: number) => {
  let index = openIndex;
  let depth = 0;

  while (index < sql.length) {
    const ignoredEndIndex = skipSqlIgnorable(sql, index);
    if (ignoredEndIndex !== index) {
      index = ignoredEndIndex;
      continue;
    }

    const quotedEndIndex = skipSqlQuotedValue(sql, index);
    if (quotedEndIndex !== index) {
      index = quotedEndIndex;
      continue;
    }

    const char = sql[index];

    if (char === '(') depth += 1;

    if (char === ')') {
      depth -= 1;
      if (depth === 0) return index;
    }

    index += 1;
  }

  return -1;
};

const skipSqlQuotedValue = (sql: string, startIndex: number) => {
  const char = sql[startIndex];

  if (char === "'") return skipSqlQuotedString(sql, startIndex, "'");
  if (char === '"') return skipSqlQuotedString(sql, startIndex, '"');
  if (char === '`') return skipSqlQuotedString(sql, startIndex, '`');
  if (char === '[') {
    const endIndex = sql.indexOf(']', startIndex + 1);
    return endIndex < 0 ? sql.length : endIndex + 1;
  }

  if (char === '$') {
    const tagMatch = /^\$[a-z_][a-z0-9_]*\$|^\$\$/i.exec(sql.slice(startIndex));

    if (!tagMatch) return startIndex;

    const tag = tagMatch[0];
    const endIndex = sql.indexOf(tag, startIndex + tag.length);

    return endIndex < 0 ? sql.length : endIndex + tag.length;
  }

  return startIndex;
};

const skipSqlQuotedString = (sql: string, startIndex: number, quote: string) => {
  let index = startIndex + 1;

  while (index < sql.length) {
    if (sql[index] !== quote) {
      index += 1;
      continue;
    }

    if (sql[index + 1] === quote) {
      index += 2;
      continue;
    }

    return index + 1;
  }

  return sql.length;
};

const hasSqlKeywordBoundary = (sql: string, startIndex: number, length: number) => {
  const previousChar = sql[startIndex - 1];
  const nextChar = sql[startIndex + length];

  return !isSqlIdentifierChar(previousChar) && !isSqlIdentifierChar(nextChar);
};

const isSqlIdentifierChar = (char: string | undefined) => {
  return !!char && /[a-z0-9_$]/i.test(char);
};
