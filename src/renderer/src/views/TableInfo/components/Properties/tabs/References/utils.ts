import type { IReferenceRow } from './dtos';

export const getReferenceRowKey = (item: IReferenceRow) =>
  `${item.table_schema}-${item.table_name}-${item.constraint_name}-${item.column_name}`;

export const getReferenceSearchValues = (row: IReferenceRow) => [
  row.constraint_name,
  row.source_table,
  row.column_name,
  row.reference_column_name,
];
