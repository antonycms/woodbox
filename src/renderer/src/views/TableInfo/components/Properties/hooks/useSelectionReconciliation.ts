import React from 'react';

interface IUseSelectionReconciliationParams<T> {
  rows: T[];
  setSelectedRows: React.Dispatch<React.SetStateAction<T[]>>;
  getSelectionKey: (row: T) => string;
}

export function useSelectionReconciliation<T>({
  rows,
  setSelectedRows,
  getSelectionKey,
}: IUseSelectionReconciliationParams<T>) {
  React.useEffect(() => {
    setSelectedRows((currentSelectedRows) => {
      if (!currentSelectedRows.length) return currentSelectedRows;

      const rowsByKey = new Map(rows.map((row) => [getSelectionKey(row), row]));
      const nextSelectedRows = currentSelectedRows
        .map((row) => rowsByKey.get(getSelectionKey(row)))
        .filter((row): row is T => !!row);

      if (
        nextSelectedRows.length === currentSelectedRows.length &&
        nextSelectedRows.every((row, index) => row === currentSelectedRows[index])
      ) {
        return currentSelectedRows;
      }

      return nextSelectedRows;
    });
  }, [getSelectionKey, rows, setSelectedRows]);
}
