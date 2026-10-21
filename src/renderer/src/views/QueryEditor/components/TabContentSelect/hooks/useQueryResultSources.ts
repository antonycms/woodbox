import React from 'react';
import type { IQueryResult } from '../../../dtos';

export const useQueryResultSources = (data: IQueryResult, readOnly?: boolean) => {
  const editableTable = React.useMemo(() => {
    if (readOnly) return;
    const table = data.row_management_table;
    if (data.supports_row_management && table) return { name: table.table, schema: table.schema };
  }, [data.row_management_table, data.supports_row_management, readOnly]);

  // Editing is optimistic. Origin, PK and SQL-shape checks happen only on save.
  const canEditCell = React.useCallback(
    (row: Record<string, unknown>, column: string) =>
      !readOnly &&
      !data.loading &&
      !row.__is_removed &&
      !column.startsWith('__') &&
      !!data.columns?.includes(column),
    [readOnly, data.loading, data.columns],
  );

  return { editableTable, canEditCell };
};
