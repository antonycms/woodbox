import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import {
  generateDeleteDdl,
  generateInsertDdl,
  generateUpdateDdl,
} from '@renderer/database/ddl';
import type { RendererDialect } from '@renderer/database/dialects';
import { useDatabaseStore } from '@renderer/stores/Database';
import { useI18nStore } from '@renderer/stores/I18n';
import { useToastStore } from '@renderer/stores/Toast';
import { getErrorMessage } from '@shared/utils/error';
import type { IColumnInfo } from '@shared/types/database';

type RowChangesMap = Map<React.Key, Record<string, unknown>>;

interface UseTableDataPersistenceParams {
  idConnection: string;
  schema: string;
  table: string;
  dialect: RendererDialect;
  columns: IColumnInfo[];
  items: Record<string, unknown>[];
  editedFieldsRows: RowChangesMap;
  droppedRows: RowChangesMap;
  newRows: RowChangesMap;
  primaryKeyColumns: string[];
  applyingChanges: boolean;
  setApplyingChanges: React.Dispatch<React.SetStateAction<boolean>>;
  setShowNoPkModal: React.Dispatch<React.SetStateAction<boolean>>;
  refreshData: (beforeApplyRows?: () => void) => Promise<void>;
  resetRows: () => void;
}

export const useTableDataPersistence = ({
  idConnection,
  schema,
  table,
  dialect,
  columns,
  items,
  editedFieldsRows,
  droppedRows,
  newRows,
  primaryKeyColumns,
  applyingChanges,
  setApplyingChanges,
  setShowNoPkModal,
  refreshData,
  resetRows,
}: UseTableDataPersistenceParams) => {
  const { runSql } = useDatabaseStore(useShallow((state) => ({ runSql: state.runSql })));
  const t = useI18nStore((state) => state.t);
  const showToast = useToastStore((state) => state.showToast);

  const applyPendingRows = React.useCallback(
    async (whereColumns: string[]) => {
      const rowsToInsert = [...newRows.values()].filter((row) => Object.keys(row).length);
      const hasEditedRows = !!editedFieldsRows.size;
      const hasDroppedRows = !!droppedRows.size;

      if ((!rowsToInsert.length && !hasEditedRows && !hasDroppedRows) || applyingChanges) return;

      const rowsToUpdate = [...editedFieldsRows.entries()]
        .map(([rowKey, changes]) => ({
          originalRow:
            items.find((item) => item.__table_hash_item === rowKey) || items[Number(rowKey)],
          rowKey,
          changes,
        }))
        .filter(
          (row) =>
            row.originalRow && Object.keys(row.changes).length && !droppedRows.has(row.rowKey),
        );

      const deleteSql = generateDeleteDdl(
        dialect,
        schema,
        table,
        [...droppedRows.values()],
        whereColumns,
      );
      const insertSql = generateInsertDdl(
        dialect,
        schema,
        table,
        rowsToInsert,
        columns.map((column) => column.column_name),
      );
      const updateSql = generateUpdateDdl(dialect, schema, table, rowsToUpdate, whereColumns);
      const sql = [deleteSql, insertSql, updateSql].filter((item) => item.trim()).join('\n\n');

      if (!sql.trim()) return;

      setApplyingChanges(true);

      try {
        await runSql(idConnection, sql);
        resetRows();
        setShowNoPkModal(false);
        showToast({ type: 'success', title: t('toast.dataSaved') });
        await refreshData(resetRows);
      } catch (error: unknown) {
        showToast({
          type: 'error',
          title: t('toast.dataSaveError'),
          description: getErrorMessage(error, t('common.unknownError')),
          delay: 8000,
        });
      } finally {
        setApplyingChanges(false);
      }
    },
    [
      editedFieldsRows,
      droppedRows,
      newRows,
      applyingChanges,
      items,
      schema,
      table,
      columns,
      dialect,
      runSql,
      idConnection,
      showToast,
      refreshData,
      resetRows,
      setApplyingChanges,
      setShowNoPkModal,
      t,
    ],
  );

  const handleSaveItems = React.useCallback(() => {
    const hasNewRows = [...newRows.values()].some((row) => Object.keys(row).length);

    if (!hasNewRows && !editedFieldsRows.size && !droppedRows.size) return;

    if ((editedFieldsRows.size || droppedRows.size) && !primaryKeyColumns.length) {
      setShowNoPkModal(true);
      return;
    }

    applyPendingRows(primaryKeyColumns);
  }, [newRows, editedFieldsRows, droppedRows, primaryKeyColumns, applyPendingRows, setShowNoPkModal]);

  const handleApplyWithoutPrimaryKey = React.useCallback(() => {
    applyPendingRows(columns.map((column) => column.column_name));
  }, [applyPendingRows, columns]);

  return { handleSaveItems, handleApplyWithoutPrimaryKey };
};
