import { formatSizeFromBytes } from '@renderer/utils/methods';
import type { IIndexInfo } from '@renderer/contexts/Store';
import type { IIndexInfoSerialized } from './dtos';

export const getIndexSelectionKey = (index: IIndexInfo) =>
  (index as IIndexInfo & { __pendingId?: string }).__pendingId || index.index_name;

export const getIndexSizeText = (index: IIndexInfo) => {
  if (index.index_size_bytes === null || index.index_size_bytes === undefined) return undefined;

  const bytes = Number(index.index_size_bytes);

  if (!Number.isFinite(bytes)) return undefined;

  return formatSizeFromBytes(bytes);
};

export const getIndexColumnsText = (index: IIndexInfo) => {
  const columnNames = index.column_names || [];

  return columnNames
    .map((columnName, indexColumn) => {
      const order = index.column_orders?.[indexColumn];

      return order ? `${columnName} ${order}` : columnName;
    })
    .join(', ');
};

export const getIndexSearchValues = (index: IIndexInfoSerialized) => [
  index.index_name,
  Array.isArray(index.column_names) ? index.column_names.join(', ') : index.column_names,
  index.column_names_display,
  index.is_unique,
  index.is_primary,
  index.index_method,
  index.is_valid,
  index.expression,
  index.predicate,
  index.index_size,
];
