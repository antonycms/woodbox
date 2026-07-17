import type { DdlIndexInfo, RendererDialectDdlHelpers } from './types';

export const getIndexColumnsDdl = (
  index: DdlIndexInfo,
  helpers: RendererDialectDdlHelpers,
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
