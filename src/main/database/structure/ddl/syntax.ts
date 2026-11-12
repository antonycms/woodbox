import type { DdlIndexInfo, StructureDialectDdlHelpers } from './types';

export const quoteLiteral = (value: string) => `'${String(value).replace(/'/g, "''")}'`;

export const getIndexColumnsDdl = (
  index: DdlIndexInfo,
  helpers: StructureDialectDdlHelpers,
  getColumnDdl: (columnName: string) => string = helpers.quoteIdent,
) => {
  return (index.column_names || [])
    .map((columnName, indexColumn) => {
      const order = index.column_orders?.[indexColumn];
      const orderDdl = order === 'ASC' || order === 'DESC' ? ` ${order}` : '';

      return `${getColumnDdl(columnName)}${orderDdl}`;
    })
    .join(', ');
};
