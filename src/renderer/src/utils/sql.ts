export interface ITableQuery {
  name: string;
  schema?: string;
  alias?: string;
}

const unsafeSqlCommands = [
  'insert',
  'update',
  'delete',
  'alter',
  'drop',
  'truncate',
  'create',
  'grant',
  'revoke',
  'merge',
  'call',
  'do',
];

const removeSqlComments = (sql: string) => {
  return sql.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/--.*$/gm, ' ');
};

const removeSqlLiterals = (sql: string) => {
  return sql
    .replace(/'([^']|'')*'/g, ' ')
    .replace(/"([^"]|"")*"/g, ' ')
    .replace(/`([^`]|``)*`/g, ' ');
};

const getFirstSqlWord = (sql: string) => {
  return sql
    .trim()
    .match(/^[a-z_]+/i)?.[0]
    ?.toLowerCase();
};

export const hasUnsafeSqlMutation = (sql: string) => {
  if (!sql || typeof sql !== 'string') return false;

  const normalizedSql = removeSqlLiterals(removeSqlComments(sql));
  const commands = normalizedSql
    .split(';')
    .map((command) => command.trim())
    .filter(Boolean);

  return commands.some((command) => {
    const firstWord = getFirstSqlWord(command);

    if (!firstWord) return false;
    if (unsafeSqlCommands.includes(firstWord)) return true;

    if (firstWord === 'with') {
      return new RegExp(`\\b(${unsafeSqlCommands.join('|')})\\b`, 'i').test(command);
    }

    return firstWord !== 'select';
  });
};

const normalizeSqlIdentifier = (value: string) => {
  return value
    ?.split('.')
    .map((part) =>
      part
        .replace(/^[`"]|[`"]$/g, '')
        .replace(/``/g, '`')
        .replace(/""/g, '"'),
    )
    .join('.');
};

const reserverdWordsToIgnoreAlias = [
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

export const getTablesFromQuerySql = (query: string) => {
  // const regex = /(?:FROM|JOIN)\s+([\w.`"]+)\s*(?!where|inner|left|on|limit|order by|group by)(?:AS\s+(\w+)|(\w+))?/gim;
  const regex = new RegExp(
    `(?:FROM|JOIN)\\s+([\\w.\`"]+)\\s*(?!${reserverdWordsToIgnoreAlias})(?:AS\\s+(\\w+)|(\\w+))?`,
    'gim',
  );

  const tables: ITableQuery[] = [];

  let match: RegExpExecArray;

  while ((match = regex.exec(query))) {
    const sqlTablePart = normalizeSqlIdentifier(match[1]);
    const aliasPart = match[2] || match[3];

    let tableSchema: string;
    let tableName: string;

    if (sqlTablePart.includes('.')) {
      [tableSchema, tableName] = sqlTablePart.split('.');
    } else {
      tableName = sqlTablePart;
    }

    if (!tableName) continue;

    tables.push({
      name: tableName,
      schema: tableSchema,
      alias: aliasPart,
    });
  }

  const updateRegex = /UPDATE\s+([\w.`"]+)/gim;
  while ((match = updateRegex.exec(query))) {
    const sqlTablePart = normalizeSqlIdentifier(match[1]);
    let tableSchema: string;
    let tableName: string;
    if (sqlTablePart.includes('.')) {
      [tableSchema, tableName] = sqlTablePart.split('.');
    } else {
      tableName = sqlTablePart;
    }
    if (!tableName) continue;
    tables.push({ name: tableName, schema: tableSchema });
  }

  const insertRegex = /INSERT\s+INTO\s+([\w.`"]+)/gim;
  while ((match = insertRegex.exec(query))) {
    const sqlTablePart = normalizeSqlIdentifier(match[1]);
    let tableSchema: string;
    let tableName: string;
    if (sqlTablePart.includes('.')) {
      [tableSchema, tableName] = sqlTablePart.split('.');
    } else {
      tableName = sqlTablePart;
    }
    if (!tableName) continue;
    tables.push({ name: tableName, schema: tableSchema });
  }

  return tables;
};

type SqlQuerySeparator = {
  index: number;
  end: number;
};

const getLineBreakEnd = (content: string, index: number) => {
  if (content[index] === '\r' && content[index + 1] === '\n') return index + 2;
  if (content[index] === '\n') return index + 1;
};

const getBlankLineSeparatorEnd = (content: string, index: number) => {
  const firstLineBreakEnd = getLineBreakEnd(content, index);

  if (firstLineBreakEnd === undefined) return;

  return getLineBreakEnd(content, firstLineBreakEnd);
};

const getSqlQuerySeparators = (content: string): SqlQuerySeparator[] => {
  const separators: SqlQuerySeparator[] = [];
  let index = 0;

  while (index < content.length) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (char === "'") {
      index++;

      while (index < content.length) {
        if (content[index] === "'" && content[index + 1] === "'") {
          index += 2;
          continue;
        }

        if (content[index] === "'") {
          index++;
          break;
        }

        index++;
      }

      continue;
    }

    if (char === '"') {
      index++;

      while (index < content.length) {
        if (content[index] === '"' && content[index + 1] === '"') {
          index += 2;
          continue;
        }

        if (content[index] === '"') {
          index++;
          break;
        }

        index++;
      }

      continue;
    }

    if (char === '-' && nextChar === '-') {
      index += 2;

      while (index < content.length && content[index] !== '\n' && content[index] !== '\r') {
        index++;
      }

      continue;
    }

    if (char === '/' && nextChar === '*') {
      index += 2;

      while (index < content.length) {
        if (content[index] === '*' && content[index + 1] === '/') {
          index += 2;
          break;
        }

        index++;
      }

      continue;
    }

    if (char === '$') {
      const dollarQuoteMatch = content.slice(index).match(/^\$[a-zA-Z_][a-zA-Z0-9_]*\$|^\$\$/);
      const delimiter = dollarQuoteMatch?.[0];

      if (delimiter) {
        const endIndex = content.indexOf(delimiter, index + delimiter.length);
        index = endIndex >= 0 ? endIndex + delimiter.length : content.length;
        continue;
      }
    }

    if (char === ';') {
      separators.push({ index, end: index + 1 });
      index++;
      continue;
    }

    const blankLineSeparatorEnd = getBlankLineSeparatorEnd(content, index);

    if (blankLineSeparatorEnd !== undefined) {
      separators.push({ index, end: blankLineSeparatorEnd });
      index = blankLineSeparatorEnd;
      continue;
    }

    index++;
  }

  return separators;
};

const trimSqlRange = (content: string, start: number, end: number) => {
  let sqlStart = start;
  let sqlEnd = end;

  while (sqlStart < sqlEnd && /\s/.test(content[sqlStart])) sqlStart++;
  while (sqlStart < sqlEnd && /\s/.test(content[sqlEnd - 1])) sqlEnd--;

  if (content[sqlStart] === ';') {
    sqlStart++;
    while (sqlStart < sqlEnd && /\s/.test(content[sqlStart])) sqlStart++;
  }

  return {
    sql: content.substring(sqlStart, sqlEnd),
    start: sqlStart,
    end: sqlEnd,
  };
};

export const getCurrentQuerySqlFromContentRange = (content: string, cursorOffset?: number) => {
  if (!content || typeof content !== 'string') return { sql: content, start: 0, end: 0 };

  const separators = getSqlQuerySeparators(content);

  if (cursorOffset === undefined) {
    let start = 0;
    let end = 0;

    for (const separator of separators) {
      start = end;
      end = separator.index;
    }

    let range = trimSqlRange(content, end, content.length);

    if (!range.sql) {
      range = trimSqlRange(content, start, content.length);
    }

    return range;
  }

  let queryStart = 0;
  let queryEnd = content.length;

  for (const separator of separators) {
    if (separator.end < cursorOffset) {
      queryStart = separator.end;
    } else {
      queryEnd = separator.index;
      break;
    }
  }

  return trimSqlRange(content, queryStart, queryEnd);
};

export const getCurrentQuerySqlFromContent = (content: string, cursorOffset?: number) => {
  return getCurrentQuerySqlFromContentRange(content, cursorOffset).sql;
};
