export const stringifyExportValue = (value: unknown) =>
  JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? String(item) : item));

export const serializeExportValue = (value: unknown) => {
  if (typeof value === 'bigint') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('base64');
  return value;
};

export const serializeExportRow = (row: Record<string, unknown>, columns: string[]) =>
  Object.fromEntries(columns.map((column) => [column, serializeExportValue(row[column])]));

export const serializeCsvCell = (value: unknown) => {
  if (value === null || value === undefined) return '';

  const serializedValue = serializeExportValue(value);
  const text =
    typeof serializedValue === 'object'
      ? stringifyExportValue(serializedValue)
      : String(serializedValue);

  return `"${text.replace(/"/g, '""')}"`;
};
