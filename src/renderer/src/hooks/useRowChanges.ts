import React from 'react';
import { useToastStore } from '@renderer/stores/Toast';
import { useI18nStore } from '@renderer/stores/I18n';
import { generateHash } from '@shared/utils/string';
import type { IColumnInfo, IColumnRestrictionsInfo } from '@shared/types/database';
import { normalizeCellValue } from '@renderer/utils/tableRows';

type DraftRow = Record<string, unknown> & {
  __key_row?: React.Key;
  __is_new_row?: boolean;
};

interface RowChangesOptions {
  items: Record<string, unknown>[];
  columns?: IColumnInfo[];
  restrictions?: IColumnRestrictionsInfo[];
  onCloseMenu: () => void;
  readOnly?: boolean;
  discardNewRowsOnCancel?: boolean;
}

const EMPTY_COLUMNS: IColumnInfo[] = [];
const EMPTY_RESTRICTIONS: IColumnRestrictionsInfo[] = [];

export const useRowChanges = ({
  items,
  columns = EMPTY_COLUMNS,
  restrictions = EMPTY_RESTRICTIONS,
  onCloseMenu,
  readOnly = false,
  discardNewRowsOnCancel = false,
}: RowChangesOptions) => {
  const showToast = useToastStore((state) => state.showToast);
  const t = useI18nStore((state) => state.t);
  const [selectedRows, setSelectedRows] = React.useState<DraftRow[]>([]);

  const [editedFieldsRows, setEditedFieldsRows] = React.useState<
    Map<React.Key, Record<string, unknown>>
  >(new Map());

  const [droppedRows, setDroppedRows] = React.useState<Map<React.Key, Record<string, unknown>>>(
    new Map(),
  );

  const [newRows, setNewRows] = React.useState<Map<React.Key, Record<string, unknown>>>(new Map());

  const primaryKeyColumns = React.useMemo(
    () =>
      restrictions.find((restriction) => restriction.constraint_type === 'primary_key')
        ?.column_names || [],
    [restrictions],
  );

  const defaultColumnNames = React.useMemo(
    () =>
      new Set(
        columns.filter((column) => column.column_default).map((column) => column.column_name),
      ),
    [columns],
  );

  const hasPendingRowsChanges = React.useMemo(
    () =>
      [...newRows.values()].some((row) => Object.keys(row).length) ||
      !!editedFieldsRows.size ||
      !!droppedRows.size,
    [newRows, editedFieldsRows, droppedRows],
  );

  const handleEditNewRow = React.useCallback(
    (rowKey: React.Key, attribute: string, value: unknown, useDefaultOnNull = true) => {
      const normalizedValue = normalizeCellValue(value);

      setNewRows((prevState) => {
        const newState = new Map(prevState);
        const prevRowEdited = { ...(newState.get(rowKey) || {}) };

        if (useDefaultOnNull && normalizedValue === null && defaultColumnNames.has(attribute)) {
          delete prevRowEdited[attribute];
          newState.set(rowKey, prevRowEdited);
          return newState;
        }

        newState.set(rowKey, { ...prevRowEdited, [attribute]: normalizedValue });

        return newState;
      });
    },
    [defaultColumnNames],
  );

  const handleEditRow = React.useCallback(
    (index: number, attribute: string, value: unknown, rowKey?: React.Key) => {
      const normalizedValue = normalizeCellValue(value);
      const key = rowKey ?? index;
      const row = items[index];

      setEditedFieldsRows((prevState) => {
        const newState = new Map(prevState);
        const prevRowEdited = { ...(newState.get(key) || {}) };
        const originalValue = row?.[attribute];

        if (String(originalValue ?? '') === String(normalizedValue ?? '')) {
          delete prevRowEdited[attribute];

          if (Object.keys(prevRowEdited).length) newState.set(key, prevRowEdited);
          else newState.delete(key);

          return newState;
        }

        newState.set(key, { ...prevRowEdited, [attribute]: normalizedValue });

        return newState;
      });
    },
    [items],
  );

  const removedRowKeys = React.useMemo(() => new Set(droppedRows.keys()), [droppedRows]);

  const handleAddItem = React.useCallback(() => {
    const key = `new_${generateHash()}`;

    setNewRows((prevState) => new Map(prevState).set(key, {}));
  }, []);

  const handleDuplicateSelectedRows = React.useCallback(() => {
    if (!selectedRows.length) {
      showToast({ type: 'warn', title: t('toast.selectRowsDuplicate') });
      return;
    }

    setNewRows((prevState) => {
      const nextState = new Map(prevState);

      selectedRows.forEach((row) => {
        const sourceRow = {
          ...row,
          ...(newRows.get(row.__key_row) || {}),
          ...(editedFieldsRows.get(row.__key_row) || {}),
        };

        const duplicatedRow = columns.reduce<Record<string, unknown>>((acc, column) => {
          if (primaryKeyColumns.includes(column.column_name)) return acc;

          acc[column.column_name] = sourceRow[column.column_name];
          return acc;
        }, {});

        nextState.set(`new_${generateHash()}`, duplicatedRow);
      });

      return nextState;
    });

    onCloseMenu();
  }, [
    columns,
    editedFieldsRows,
    newRows,
    primaryKeyColumns,
    selectedRows,
    showToast,
    t,
    onCloseMenu,
  ]);

  const handleCancelSelectedRowsEditions = React.useCallback(() => {
    if (!selectedRows.length) return;

    if (discardNewRowsOnCancel) {
      setNewRows((prevState) => {
        const nextState = new Map(prevState);
        selectedRows.forEach((row) => {
          if (row.__is_new_row) nextState.delete(row.__key_row);
        });
        return nextState;
      });
    }

    setEditedFieldsRows((prevState) => {
      const newState = new Map(prevState);

      selectedRows.forEach((row) => {
        newState.delete(row.__key_row);
      });

      return newState;
    });
  }, [discardNewRowsOnCancel, selectedRows]);

  const handleUndoSelectedDroppedRows = React.useCallback(() => {
    if (!selectedRows.length) return;

    setDroppedRows((prevState) => {
      const newState = new Map(prevState);

      selectedRows.forEach((row) => {
        newState.delete(row.__key_row);
      });

      return newState;
    });
  }, [selectedRows]);

  const handleRemoveSelectedRows = React.useCallback(() => {
    if (readOnly) return;

    if (!selectedRows.length) {
      showToast({ type: 'warn', title: t('toast.selectRowsRemove') });
      return;
    }

    setNewRows((prevState) => {
      const nextState = new Map(prevState);

      selectedRows.forEach((row) => {
        if (row.__is_new_row) nextState.delete(row.__key_row);
      });

      return nextState;
    });

    setDroppedRows((prevState) => {
      const nextState = new Map(prevState);

      selectedRows.forEach((row) => {
        if (!row.__is_new_row) nextState.set(row.__key_row, row);
      });

      return nextState;
    });

    setEditedFieldsRows((prevState) => {
      const nextState = new Map(prevState);

      selectedRows.forEach((row) => {
        nextState.delete(row.__key_row);
      });

      return nextState;
    });

    onCloseMenu();
  }, [readOnly, selectedRows, showToast, t, onCloseMenu]);

  const resetRows = React.useCallback(() => {
    setNewRows(new Map());
    setEditedFieldsRows(new Map());
    setDroppedRows(new Map());
  }, []);

  return {
    editedFieldsRows,
    droppedRows,
    newRows,
    primaryKeyColumns,
    hasPendingRowsChanges,
    handleEditNewRow,
    handleEditRow,
    removedRowKeys,
    handleAddItem,
    handleDuplicateSelectedRows,
    handleCancelSelectedRowsEditions,
    handleUndoSelectedDroppedRows,
    handleRemoveSelectedRows,
    setSelectedRows,
    resetRows,
  };
};
