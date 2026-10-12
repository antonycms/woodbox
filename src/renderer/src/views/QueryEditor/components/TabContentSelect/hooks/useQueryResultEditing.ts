import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useDatabaseStore } from '@renderer/stores/Database';
import { useI18nStore } from '@renderer/stores/I18n';
import { useToastStore } from '@renderer/stores/Toast';
import {
  generateDeleteDdl,
  generateInsertDdl,
  generateUpdateDdl,
} from '@renderer/database/ddl';
import type { RendererDialect } from '@renderer/database/dialects';
import type { IQueryResult } from '@renderer/views/QueryEditor/dtos';
import type { IColumnRestrictionsInfo } from '@shared/types/database';
import { getErrorMessage } from '@shared/utils/error';

interface UseQueryResultEditingParams {
  idConnection: string;
  data: IQueryResult;
  dialect: RendererDialect;
  editableTable?: NonNullable<IQueryResult['tables_info']>[number];
  editedFieldsRows: Map<React.Key, Record<string, unknown>>;
  droppedRows: Map<React.Key, Record<string, unknown>>;
  newRows: Map<React.Key, Record<string, unknown>>;
  resetRows: () => void;
  onRefresh: () => void;
}

export const useQueryResultEditing = ({
  idConnection,
  data,
  dialect,
  editableTable,
  editedFieldsRows,
  droppedRows,
  newRows,
  resetRows,
  onRefresh,
}: UseQueryResultEditingParams) => {
  const { getTableRestrictions, runSql } = useDatabaseStore(
    useShallow((state) => ({
      getTableRestrictions: state.getTableRestrictions,
      runSql: state.runSql,
    })),
  );
  const t = useI18nStore((state) => state.t);
  const showToast = useToastStore((state) => state.showToast);
  const [saving, setSaving] = React.useState(false);
  const [restrictionsCache, setRestrictionsCache] = React.useState(
    new Map<string, IColumnRestrictionsInfo[]>(),
  );

  const getPrimaryKeyColumns = React.useCallback(async () => {
    if (!editableTable?.name) return [];

    const key = `${editableTable.schema}.${editableTable.name}`;

    let _restrictions = restrictionsCache.get(key);

    if (!_restrictions) {
      _restrictions = await getTableRestrictions(idConnection, {
        schema: editableTable.schema,
        table: editableTable.name,
      });

      setRestrictionsCache((prevState) => {
        const nextState = new Map(prevState);
        nextState.set(key, _restrictions || []);
        return nextState;
      });
    }

    const pk = _restrictions.find((restriction) => restriction.constraint_type === 'primary_key');

    return pk?.column_names || [];
  }, [idConnection, editableTable, getTableRestrictions, restrictionsCache]);

  const handleSave = React.useCallback(async () => {
    const rowsToInsert = [...newRows.values()].filter((row) => Object.keys(row).length);
    const rowsToDelete = [...droppedRows.values()];

    if ((!rowsToInsert.length && !editedFieldsRows.size && !rowsToDelete.length) || saving) {
      return;
    }

    if (!editableTable?.name) {
      showToast({
        type: 'error',
        title: t('toast.saveNotPossible'),
        description: t('toast.querySingleTableRequired'),
      });

      return;
    }

    setSaving(true);

    try {
      let deleteSql = '';
      let updateSql = '';

      if (editedFieldsRows.size || rowsToDelete.length) {
        const primaryKeyColumns = await getPrimaryKeyColumns();

        if (!primaryKeyColumns.length) {
          const fullName = [editableTable.schema, editableTable.name].filter(Boolean).join('.');

          showToast({
            type: 'error',
            title: t('toast.saveNotPossible'),
            description: t('query.tableNoPrimaryKey', { table: fullName }),
          });

          return;
        }

        const missingPk = primaryKeyColumns.find((pkColumn) => !data.columns?.includes(pkColumn));

        if (missingPk) {
          showToast({
            type: 'error',
            title: t('toast.saveNotPossible'),
            description: t('query.rowMissingPk', { pk: missingPk }),
          });

          return;
        }

        if (rowsToDelete.length) {
          deleteSql = generateDeleteDdl(
            dialect,
            editableTable.schema,
            editableTable.name,
            rowsToDelete,
            primaryKeyColumns,
          );
        }

        if (editedFieldsRows.size) {
          const rowsToUpdate = [...editedFieldsRows.entries()]
            .map(([index, changes]) => ({
              originalRow: data.rows[Number(index)],
              changes,
              rowKey: index,
            }))
            .filter((row) => !droppedRows.has(row.rowKey));

          updateSql = generateUpdateDdl(
            dialect,
            editableTable.schema,
            editableTable.name,
            rowsToUpdate,
            primaryKeyColumns,
          );
        }
      }

      const insertSql = generateInsertDdl(
        dialect,
        editableTable.schema,
        editableTable.name,
        rowsToInsert,
        data.columns,
      );
      const sql = [deleteSql, insertSql, updateSql].filter((item) => item.trim()).join('\n\n');

      if (!sql) return;

      await runSql(idConnection, sql);

      resetRows();
      showToast({ type: 'success', title: t('toast.dataSaved') });
      onRefresh();
    } catch (error: unknown) {
      showToast({
        type: 'error',
        title: t('toast.dataSaveError'),
        description: getErrorMessage(error, t('common.unknownError')),
        delay: 8000,
      });
    } finally {
      setSaving(false);
    }
  }, [
    data.rows,
    data.columns,
    droppedRows,
    editedFieldsRows,
    editableTable,
    getPrimaryKeyColumns,
    idConnection,
    newRows,
    onRefresh,
    runSql,
    resetRows,
    dialect,
    saving,
    showToast,
    t,
  ]);

  return { saving, handleSave };
};
