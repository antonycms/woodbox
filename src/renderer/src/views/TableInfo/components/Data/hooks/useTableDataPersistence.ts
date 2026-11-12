import React from 'react';
import { useRowChangesPersistence } from '@renderer/hooks/useRowChangesPersistence';
import { pickRowColumns } from '@renderer/utils/tableRows';
import { useI18nStore } from '@renderer/stores/I18n';
import { useToastStore } from '@renderer/stores/Toast';
import type { IColumnInfo } from '@shared/types/database';

type RowChangesMap = Map<React.Key, Record<string, unknown>>;

interface UseTableDataPersistenceParams {
  idConnection: string;
  schema: string;
  table: string;
  columns: IColumnInfo[];
  primaryKeyColumns: string[];
  items: Record<string, unknown>[];
  editedFieldsRows: RowChangesMap;
  droppedRows: RowChangesMap;
  newRows: RowChangesMap;
  loading: boolean;
  readOnly?: boolean;
  setShowNoPkModal: React.Dispatch<React.SetStateAction<boolean>>;
  refreshData: (beforeApplyRows?: () => void) => Promise<void>;
  resetRows: () => void;
}

export const useTableDataPersistence = ({
  idConnection, schema, table, columns, primaryKeyColumns, items, editedFieldsRows, droppedRows, newRows,
  loading, readOnly, setShowNoPkModal, refreshData, resetRows,
}: UseTableDataPersistenceParams) => {
  const t = useI18nStore((state) => state.t);
  const showToast = useToastStore((state) => state.showToast);
  const { saving, save } = useRowChangesPersistence({
    idConnection,
    context: [idConnection, schema, table, items, columns, primaryKeyColumns, loading, !!readOnly],
    onSaved: async (isCurrent) => {
      resetRows();
      setShowNoPkModal(false);
      await refreshData(() => { if (isCurrent()) resetRows(); });
    },
  });

  const applyPendingRows = async (confirmWithoutPrimaryKey = false) => {
    if (saving || loading || readOnly) return;
    const inserts = [...newRows.values()].filter((row) => Object.keys(row).length);
    if (!inserts.length && !editedFieldsRows.size && !droppedRows.size) return;
    if ((editedFieldsRows.size || droppedRows.size) && !primaryKeyColumns.length && !confirmWithoutPrimaryKey) {
      setShowNoPkModal(true);
      return;
    }
    const whereColumns = primaryKeyColumns.length ? primaryKeyColumns : columns.map((column) => column.column_name);
    const byKey = new Map<React.Key, Record<string, unknown>>();
    for (const row of editedFieldsRows.size ? items : []) {
      const key = row.__table_hash_item;
      if ((typeof key === 'string' || typeof key === 'number' || typeof key === 'bigint') && !byKey.has(key)) byKey.set(key, row);
    }
    const updates = [...editedFieldsRows].flatMap(([key, changes]) => {
      const original = byKey.get(key) || items[Number(key)];
      return original && Object.keys(changes).length && !droppedRows.has(key)
        ? [{ filters: pickRowColumns(original, whereColumns), values: changes }] : [];
    });
    const deletes = [...droppedRows.values()].map((row) => pickRowColumns(row, whereColumns));
    const filters = [...updates.map((row) => row.filters), ...deletes];
    const missingColumn = whereColumns.find((column) => filters.some((row) =>
      !Object.hasOwn(row, column) || (primaryKeyColumns.length > 0 && row[column] == null)));
    if (missingColumn) {
      showToast({ type: 'warn', title: t('toast.saveNotPossible'),
        description: t('table.missingRowIdentityColumn', { column: missingColumn }) });
      return;
    }
    return save({ source: { type: 'table', schema, table }, inserts, updates, deletes });
  };

  return {
    saving,
    handleSaveItems: () => applyPendingRows(),
    handleApplyWithoutPrimaryKey: () => applyPendingRows(true),
  };
};
