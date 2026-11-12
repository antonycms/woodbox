import type { CompareColumnInfo } from './types';

export const pushSemicolon = (sql: string) => {
  const text = sql.trim();
  if (!text) return '';
  return text.endsWith(';') ? text : `${text};`;
};

export const normalizeOptional = (value: unknown) => {
  if (value === undefined || value === null) return '';
  return String(value).trim();
};

export const qualifiedName = (
  quoteIdentifier: (value: string) => string,
  schema: string | undefined,
  name: string,
) => (schema ? `${quoteIdentifier(schema)}.${quoteIdentifier(name)}` : quoteIdentifier(name));

export const makeColumnType = (column: CompareColumnInfo) => {
  const dataType = normalizeOptional(column.udt_name || column.data_type) || 'text';
  const length = Number(column.character_maximum_length || 0);
  const precision = Number(column.numeric_precision || 0);
  const scale = Number(column.numeric_scale || 0);

  if (length && !dataType.includes('(')) return `${dataType}(${length})`;
  if (precision && !dataType.includes('(')) {
    return scale ? `${dataType}(${precision}, ${scale})` : `${dataType}(${precision})`;
  }

  return dataType;
};

export const makeColumnDefinition = (
  quoteIdentifier: (value: string) => string,
  column: CompareColumnInfo,
) => {
  const defaultSql = normalizeOptional(column.column_default);
  const notNull = column.is_nullable === false ? ' NOT NULL' : '';
  const autoIncrement = column.is_auto_increment ? ' AUTO_INCREMENT' : '';

  return `${quoteIdentifier(column.column_name)} ${makeColumnType(column)}${
    defaultSql ? ` DEFAULT ${defaultSql}` : ''
  }${notNull}${autoIncrement}`;
};

export const unsupportedDdl = (message: string) => `-- ${message}`;
