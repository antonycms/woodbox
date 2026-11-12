import React from 'react';
import type { IQueryResult } from '@renderer/views/QueryEditor/dtos';
import { useRowChangesPersistence } from '@renderer/hooks/useRowChangesPersistence';
import { pickRowColumns } from '@renderer/utils/tableRows';
import { prepareQueryVariables } from '../../../utils/queryVariables';

interface UseQueryResultEditingParams {
  idConnection: string;
  data: IQueryResult;
  readOnly?: boolean;
  editedFieldsRows: Map<React.Key, Record<string, unknown>>;
  droppedRows: Map<React.Key, Record<string, unknown>>;
  newRows: Map<React.Key, Record<string, unknown>>;
  resetRows: () => void;
  onRefresh: () => void;
}

export const useQueryResultEditing = ({
  idConnection, data, readOnly, editedFieldsRows, droppedRows, newRows, resetRows, onRefresh,
}: UseQueryResultEditingParams) => {
  const { saving, save } = useRowChangesPersistence({
    idConnection,
    context: [idConnection, data.rows, data.columns, data.columns_info, data.query,
      data.variableValues, data.queryExecutionId, data.date_run, data.type, !!data.loading, !!readOnly],
    onSaved: () => { resetRows(); onRefresh(); },
  });

  const handleSave = () => {
    if (data.loading || readOnly) return;
    const columns = data.columns || [];
    return save({
      source: {
        type: 'query', sql: prepareQueryVariables(data.query, data.variableValues),
        columns: data.columns_info || columns.map((name) => ({ name })),
      },
      inserts: [...newRows.values()].filter((row) => Object.keys(row).length),
      updates: [...editedFieldsRows].filter(([index, changes]) => !droppedRows.has(index) && Object.keys(changes).length)
        .map(([index, changes]) => ({ original: pickRowColumns(data.rows?.[Number(index)] || {}, columns), changes })),
      deletes: [...droppedRows.values()].map((row) => pickRowColumns(row, columns)),
    });
  };

  return { saving, handleSave };
};
