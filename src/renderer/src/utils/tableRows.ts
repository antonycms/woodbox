export const normalizeCellValue = (value: unknown) => (value === '' ? null : value);

// Select real result/catalog fields rather than stripping an entire prefix:
// TableInfo may display legitimate database columns beginning with "__".
export const pickRowColumns = (row: Record<string, unknown>, columns: string[]) =>
  Object.fromEntries(columns.filter((column) => Object.hasOwn(row, column)).map((column) => [column, row[column]]));
