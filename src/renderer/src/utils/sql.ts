export interface ITableQuery {
  name: string;
  schema?: string;
  alias?: string;
}

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
  // const regex = /(?:FROM|JOIN)\s+([\w.]+)\s*(?!where|inner|left|on|limit|order by|group by)(?:AS\s+(\w+)|(\w+))?/gim;
  const regex = new RegExp(
    `(?:FROM|JOIN)\\s+([\\w.]+)\\s*(?!${reserverdWordsToIgnoreAlias})(?:AS\\s+(\\w+)|(\\w+))?`,
    'gim',
  );

  const tables: ITableQuery[] = [];

  let match: RegExpExecArray;

  while ((match = regex.exec(query))) {
    const sqlTablePart = match[1];
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

  const updateRegex = /UPDATE\s+([\w.]+)/gim;
  while ((match = updateRegex.exec(query))) {
    const sqlTablePart = match[1];
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

  const insertRegex = /INSERT\s+INTO\s+([\w.]+)/gim;
  while ((match = insertRegex.exec(query))) {
    const sqlTablePart = match[1];
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

export const getCurrentQuerySqlFromContent = (content: string, cursorOffset?: number) => {
  if (!content || typeof content !== 'string') return content;

  const regex = /(;|\r?\n\r?\n)/g;

  if (cursorOffset === undefined) {
    let start = 0;
    let end = 0;
    let result: RegExpExecArray;

    while ((result = regex.exec(content))) {
      start = end;
      end = result.index;
    }

    let chunk = content.substring(end, content.length).trim();

    if (chunk.startsWith(';')) {
      chunk = chunk.substring(0 + 1).trim();
    }
    if (!chunk) {
      chunk = content.substring(start, content.length).trim();
    }

    return chunk;
  }

  let queryStart = 0;
  let queryEnd = content.length;
  let result: RegExpExecArray;

  while ((result = regex.exec(content))) {
    const sepEnd = result.index + result[0].length;
    if (sepEnd <= cursorOffset) {
      queryStart = sepEnd;
    } else {
      queryEnd = result.index;
      break;
    }
  }

  return content.substring(queryStart, queryEnd).trim();
};
