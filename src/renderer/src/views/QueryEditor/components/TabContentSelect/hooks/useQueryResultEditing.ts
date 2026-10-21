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
import { buildQueryUpdates, getQueryEditTargets } from '@renderer/database/queryEditing';
import { queryTableKey } from '@shared/utils/queryUpdates';
import { prepareQueryVariables } from '../../../utils/queryVariables';

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
  const { getTableRestrictions, runSql, updateQueryRows, resolveQueryResultColumns } = useDatabaseStore(
    useShallow((state) => ({
      getTableRestrictions: state.getTableRestrictions,
      runSql: state.runSql,
      updateQueryRows: state.updateQueryRows,
      resolveQueryResultColumns: state.resolveQueryResultColumns,
    })),
  );
  const t = useI18nStore((state) => state.t);
  const showToast = useToastStore((state) => state.showToast);
  const [saving, setSaving] = React.useState(false);
  const [restrictionsCache, setRestrictionsCache] = React.useState(
    new Map<string, IColumnRestrictionsInfo[]>(),
  );
  const savingRef = React.useRef(false);
  const mountedRef = React.useRef(true);
  const resultContext = [idConnection, data.rows, data.columns, data.columns_info,
    data.query, data.variableValues, data.queryExecutionId, data.date_run, data.type, !!data.loading];
  const resultContextRef = React.useRef(resultContext);
  if (resultContext.some((value, index) => value !== resultContextRef.current[index])) {
    resultContextRef.current = resultContext;
  }

  const getPrimaryKeyColumns = React.useCallback(async (table = editableTable) => {
    if (!table?.name) return [];

    const key = `${idConnection}:${table.schema}.${table.name}`;

    let _restrictions = restrictionsCache.get(key);

    if (!_restrictions) {
      _restrictions = await getTableRestrictions(idConnection, {
        schema: table.schema,
        table: table.name,
      });

      if (mountedRef.current) setRestrictionsCache((prevState) => {
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

    if ((!rowsToInsert.length && !editedFieldsRows.size && !rowsToDelete.length) || savingRef.current || data.loading) {
      return;
    }

    savingRef.current = true;
    const context = resultContextRef.current;
    const isCurrentResult = () => mountedRef.current && resultContextRef.current === context;
    if (!editableTable) {
      setSaving(true);
      try {
        if (rowsToInsert.length || rowsToDelete.length) {
          showToast({ type: 'warn', title: t('toast.saveNotPossible'), description: t('query.joinUpdateOnly') });
          return;
        }
        const columns = await resolveQueryResultColumns(idConnection, {
          sql: prepareQueryVariables(data.query, data.variableValues),
          columns: data.columns_info || (data.columns || []).map((name) => ({ name })),
        });
        if (!isCurrentResult()) return;
        const changedColumns = new Set([...editedFieldsRows.values()].flatMap((changes) => Object.keys(changes)));
        const tables = new Map(columns.flatMap(({ name, source }) =>
          source && changedColumns.has(name) ? [[queryTableKey(source), source] as const] : []));
        const restrictions = new Map(await Promise.all([...tables].map(async ([key, table]) => [
          key, await getTableRestrictions(idConnection, { schema: table.schema, table: table.table }),
        ] as const)));
        if (!isCurrentResult()) return;
        const targets = getQueryEditTargets(columns, restrictions);
        const result = buildQueryUpdates(data.rows || [], editedFieldsRows, targets);
        if (result.error) {
          showToast({
            type: 'warn', title: t('toast.saveNotPossible'),
            description: t(result.error === 'conflict' ? 'query.conflictingUpdates' : 'query.columnReadOnly'),
          });
          return;
        }
        await updateQueryRows(idConnection, result.updates);
        if (!isCurrentResult()) return;
        resetRows();
        showToast({ type: 'success', title: t('toast.dataSaved') });
        onRefresh();
      } catch (error: unknown) {
        if (!isCurrentResult()) return;
        showToast({
          type: 'error',
          title: t('toast.dataSaveError'),
          description: getErrorMessage(error, t('common.unknownError')),
          delay: 8000,
        });
      } finally {
        savingRef.current = false;
        if (mountedRef.current) setSaving(false);
      }
      return;
    }

    setSaving(true);

    try {
      let targetTable = editableTable;
      // Unqualified names may depend on search_path. Resolve their native
      // origin only now, without adding any metadata queries to the SELECT.
      if (!targetTable.schema && data.columns_info?.some((column) => column.source_ref)) {
        const columns = await resolveQueryResultColumns(idConnection, {
          sql: prepareQueryVariables(data.query, data.variableValues), columns: data.columns_info,
        });
        if (!isCurrentResult()) return;
        const source = columns[0]?.source;
        if (!source || !columns.every((column) => column.source?.table === source.table &&
          column.source.schema === source.schema && column.name === column.source.column)) {
          showToast({ type: 'warn', title: t('toast.saveNotPossible'), description: t('query.columnReadOnly') });
          return;
        }
        targetTable = { name: source.table, schema: source.schema };
      }
      let deleteSql = '';
      let updateSql = '';

      if (editedFieldsRows.size || rowsToDelete.length) {
        const primaryKeyColumns = await getPrimaryKeyColumns(targetTable);
        if (!isCurrentResult()) return;

        if (!primaryKeyColumns.length) {
          const fullName = [targetTable.schema, targetTable.name].filter(Boolean).join('.');

          showToast({
            type: 'warn',
            title: t('toast.saveNotPossible'),
            description: t('query.tableNoPrimaryKey', { table: fullName }),
          });

          return;
        }

        const rowsToUpdate = [...editedFieldsRows.entries()]
          .filter(([index]) => !droppedRows.has(index))
          .map(([index, changes]) => ({ originalRow: data.rows?.[Number(index)], changes }));
        const affectedRows = [...rowsToDelete, ...rowsToUpdate.map((row) => row.originalRow)];
        const missingPk = primaryKeyColumns.find((pkColumn) =>
          !data.columns?.includes(pkColumn) || affectedRows.some((row) => row?.[pkColumn] == null));

        if (missingPk) {
          showToast({
            type: 'warn',
            title: t('toast.saveNotPossible'),
            description: t('query.rowMissingPk', { pk: missingPk }),
          });

          return;
        }

        if (rowsToDelete.length) {
          deleteSql = generateDeleteDdl(
            dialect,
            targetTable.schema,
            targetTable.name,
            rowsToDelete,
            primaryKeyColumns,
          );
        }

        if (editedFieldsRows.size) {
          updateSql = generateUpdateDdl(
            dialect,
            targetTable.schema,
            targetTable.name,
            rowsToUpdate,
            primaryKeyColumns,
          );
        }
      }

      const insertSql = generateInsertDdl(
        dialect,
        targetTable.schema,
        targetTable.name,
        rowsToInsert,
        data.columns,
      );
      const sql = [deleteSql, insertSql, updateSql].filter((item) => item.trim()).join('\n\n');

      if (!sql) return;

      if (!isCurrentResult()) return;
      await runSql(idConnection, sql, {
        rowChangesTransaction: { schema: targetTable.schema, table: targetTable.name },
      });
      if (!isCurrentResult()) return;

      resetRows();
      showToast({ type: 'success', title: t('toast.dataSaved') });
      onRefresh();
    } catch (error: unknown) {
      if (!isCurrentResult()) return;
      showToast({
        type: 'error',
        title: t('toast.dataSaveError'),
        description: getErrorMessage(error, t('common.unknownError')),
        delay: 8000,
      });
    } finally {
      savingRef.current = false;
      if (mountedRef.current) setSaving(false);
    }
  }, [
    data.rows,
    data.columns,
    data.columns_info,
    data.query,
    data.variableValues,
    data.loading,
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
    showToast,
    t,
    getTableRestrictions,
    resolveQueryResultColumns,
    updateQueryRows,
  ]);

  React.useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  return { saving, handleSave };
};
