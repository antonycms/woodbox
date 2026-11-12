import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import type { IEditorRef } from '@renderer/components/Editor';
import type { ISortDirection } from '@renderer/components/Table/dtos';
import type { Dialect } from '@shared/types/connections';
import { generateHash } from '@shared/utils/string';
import { useDatabaseStore } from '@renderer/stores/Database';
import { useI18nStore } from '@renderer/stores/I18n';
import { getNextSort } from '@renderer/utils/tableSort';
import { prepareQueryVariables } from '../utils/queryVariables';
import {
  formatQueryErrorMessage,
  formatQueryExecutionErrorMessage,
  getQueryErrorOffset,
  makeQueryErrorMarker,
  makeCanceledQueryResult,
} from '../utils/queryResult';
import type { IExecuteQueryParams } from '../dtos';
import { useQueryCancellation } from './useQueryCancellation';
import type { useQueryResults } from './useQueryResults';

interface QueryExecutionOptions {
  id_connection: string;
  dialect: Dialect;
  refEditor: React.RefObject<IEditorRef>;
  results: Pick<
    ReturnType<typeof useQueryResults>,
    'resultActiveTabId' | 'querysResultData' | 'beginResultExecution' | 'getResultExecution'
  >;
}

export const useQueryExecution = ({
  id_connection,
  dialect,
  refEditor,
  results,
}: QueryExecutionOptions) => {
  const t = useI18nStore((state) => state.t);
  const { runSql, cancelRunSql, runExplainSql } = useDatabaseStore(
    useShallow((state) => ({
      runSql: state.runSql,
      cancelRunSql: state.cancelRunSql,
      runExplainSql: state.runExplainSql,
    })),
  );
  const { resultActiveTabId: activeTabId, querysResultData, beginResultExecution, getResultExecution } = results;
  const pendingQueryIdsRef = React.useRef(new Set<string>());
  const editorExecutionRef = React.useRef<object | undefined>(undefined);
  const {
    cancelingQueryIds,
    forgetCanceledQuery,
    markQueryCanceling,
    removeCancelingQueryId,
    wasQueryCanceled,
  } = useQueryCancellation();

  const executeQuery = async (params: IExecuteQueryParams) => {
    const { query, openNewTab, forceNewTab, markErrors, variableValues } = params;
    const preparedQuery = prepareQueryVariables(query, variableValues);
    const previous = activeTabId ? querysResultData.get(activeTabId) : undefined;
    const columnTypes = !forceNewTab && !openNewTab && getResultExecution(activeTabId)?.isCurrent() && previous?.type === 'SELECT' &&
      prepareQueryVariables(previous.query, previous.variableValues) === preparedQuery
      ? previous.columns_info?.map(({ name, type }) => ({ name, type })) : undefined;
    const queryExecutionId = generateHash();

    const execution = beginResultExecution(
      !forceNewTab && !openNewTab && activeTabId
        ? { idTab: activeTabId, queryExecutionId }
        : { queryExecutionId, data: {
            query,
            variableValues,
            type: 'SELECT',
            date_run: new Date().toISOString(),
          } },
    );
    if (!execution) return;
    const updateTabResultData = execution.update;
    const editorExecution = {};
    editorExecutionRef.current = editorExecution;
    const editor = refEditor.current;
    const editorValue = editor?.getValue?.();
    pendingQueryIdsRef.current.add(queryExecutionId);

    updateTabResultData({
      type: 'SELECT',
      query,
      variableValues,
      loading: true,
      queryExecutionId,
      resultRevision: queryExecutionId,
      date_run: new Date().toISOString(),
    });

    try {
      editor?.setMarkers([]);

      const [
        { type, rows, columns, columns_info, column_sources_resolved, supports_row_management, row_management_table, affected_rows, auto_paginated, execution_time_ms },
      ] = await runSql(id_connection, preparedQuery, { queryExecutionId, ...(columnTypes?.length ? { columnTypes } : {}) });

      const canceled = wasQueryCanceled(queryExecutionId);
      if (!execution.isCurrent()) return;
      if (canceled) {
        updateTabResultData(
          makeCanceledQueryResult(t('toast.queryCanceled'), { query, variableValues }),
        );
        return;
      }

      updateTabResultData({
        page: 1,
        query,
        variableValues,
        columns,
        columns_info,
        column_sources_resolved,
        supports_row_management,
        row_management_table,
        rows,
        type,
        affected_rows,
        auto_paginated,
        execution_time_ms,
        loading: false,
        queryExecutionId: undefined,
      });
    } catch (error) {
      const canceled = wasQueryCanceled(queryExecutionId);
      if (!execution.isCurrent()) return;
      if (canceled) {
        updateTabResultData(
          makeCanceledQueryResult(t('toast.queryCanceled'), { query, variableValues }),
        );
        return;
      }

      const message = formatQueryExecutionErrorMessage(error, t('common.unknownErrorNoDot'), markErrors);

      updateTabResultData({
        type: 'ERROR',
        query,
        variableValues,
        message,
        loading: false,
        queryExecutionId: undefined,
      });

      if (editorExecutionRef.current !== editorExecution || !editor ||
        refEditor.current !== editor || editor.getValue?.() !== editorValue) return;

      const errorOffset = getQueryErrorOffset(error);

      if (errorOffset === undefined) return;

      const editorQueryStartOffset = params.editorOffset || 0;
      const errorPosition = editor.getPositionAt(editorQueryStartOffset + errorOffset);
      const endPosition = editor.getPositionAt(editorQueryStartOffset + query.length);

      if (!errorPosition || !endPosition) return;

      editor.setMarkers([makeQueryErrorMarker(message, errorPosition, endPosition)]);
      editor.setPosition(errorPosition);
    } finally {
      pendingQueryIdsRef.current.delete(queryExecutionId);
      forgetCanceledQuery(queryExecutionId);
    }
  };

  const executeExplainQuery = async (params: IExecuteQueryParams) => {
    const { query, variableValues } = params;
    const preparedQuery = prepareQueryVariables(query, variableValues);
    const dialectId = dialect;
    const queryExecutionId = generateHash();

    const execution = beginResultExecution({ queryExecutionId, data: {
      query,
      variableValues,
      type: 'EXPLAIN',
      title: t('query.explainTabTitle'),
      date_run: new Date().toISOString(),
      explain: {
        dialect: dialectId,
        originalQuery: query,
      },
    } });
    if (!execution) return;
    const updateTabResultData = execution.update;
    editorExecutionRef.current = {};
    pendingQueryIdsRef.current.add(queryExecutionId);

    updateTabResultData({
      type: 'EXPLAIN',
      loading: true,
      queryExecutionId,
      resultRevision: queryExecutionId,
      date_run: new Date().toISOString(),
    });

    try {
      const [result] = await runExplainSql(id_connection, preparedQuery, {
        queryExecutionId,
      });

      const canceled = wasQueryCanceled(queryExecutionId);
      if (!execution.isCurrent()) return;
      if (canceled) {
        updateTabResultData(
          makeCanceledQueryResult(t('toast.queryCanceled'), { query, variableValues }),
        );
        return;
      }

      const { explainAnalysis, ...resultData } = result;
      updateTabResultData({
        ...resultData,
        type: 'EXPLAIN',
        query,
        variableValues,
        loading: false,
        queryExecutionId: undefined,
        explain: {
          dialect: dialectId,
          originalQuery: query,
          analysis: explainAnalysis,
        },
      });
    } catch (error) {
      const canceled = wasQueryCanceled(queryExecutionId);
      if (!execution.isCurrent()) return;
      if (canceled) {
        updateTabResultData(
          makeCanceledQueryResult(t('toast.queryCanceled'), { query, variableValues }),
        );
        return;
      }

      updateTabResultData({
        type: 'ERROR',
        query,
        variableValues,
        message: formatQueryExecutionErrorMessage(error, t('common.unknownErrorNoDot')),
        loading: false,
        queryExecutionId: undefined,
      });
    } finally {
      pendingQueryIdsRef.current.delete(queryExecutionId);
      forgetCanceledQuery(queryExecutionId);
    }
  };

  const cancelResultQuery = async (idTab: string) => {
    const tab = querysResultData.get(idTab);

    if (!tab?.loading || !tab.queryExecutionId) return;

    const execution = getResultExecution(idTab, tab.queryExecutionId);
    if (!execution || !pendingQueryIdsRef.current.has(tab.queryExecutionId)) return;
    markQueryCanceling(tab.queryExecutionId);

    let canceled = false;

    try {
      canceled = await cancelRunSql(id_connection, tab.queryExecutionId);

      if (canceled && execution.isCurrent()) {
        execution.update(makeCanceledQueryResult(t('toast.queryCanceled'), tab));
      }
    } finally {
      if (!canceled || !pendingQueryIdsRef.current.has(tab.queryExecutionId)) forgetCanceledQuery(tab.queryExecutionId);
      removeCancelingQueryId(tab.queryExecutionId);
    }
  };

  const refreshResultSqlTab = async (idTab: string) => {
    const tab = querysResultData.get(idTab);
    if (!tab) return;
    const preparedQuery = prepareQueryVariables(tab.query, tab.variableValues);
    const queryExecutionId = generateHash();
    const execution = beginResultExecution({ idTab, queryExecutionId });
    if (!execution) return;
    const updateTabResultData = execution.update;
    pendingQueryIdsRef.current.add(queryExecutionId);

    updateTabResultData({
      loading: true,
      queryExecutionId,
      resultRevision: queryExecutionId,
      date_run: new Date().toISOString(),
    });

    try {
      const [
        { type, rows, columns, columns_info, column_sources_resolved, supports_row_management, row_management_table, affected_rows, auto_paginated, execution_time_ms },
      ] = await runSql(id_connection, preparedQuery, {
        orderBy: tab.orderBy,
        queryExecutionId,
      });

      const canceled = wasQueryCanceled(queryExecutionId);
      if (!execution.isCurrent()) return;
      if (canceled) {
        updateTabResultData(makeCanceledQueryResult(t('toast.queryCanceled'), tab));
        return;
      }

      updateTabResultData({
        page: 1,
        columns,
        columns_info,
        column_sources_resolved,
        supports_row_management,
        row_management_table,
        rows,
        type,
        query: tab.query,
        variableValues: tab.variableValues,
        affected_rows,
        auto_paginated,
        execution_time_ms,
        loading: false,
        orderBy: tab.orderBy,
        queryExecutionId: undefined,
        captureRows: true,
      });
    } catch (error) {
      const canceled = wasQueryCanceled(queryExecutionId);
      if (!execution.isCurrent()) return;
      if (canceled) {
        updateTabResultData(makeCanceledQueryResult(t('toast.queryCanceled'), tab));
        return;
      }

      const message = formatQueryErrorMessage(error, t('common.unknownErrorNoDot'));
      updateTabResultData({
        type: 'ERROR',
        message,
        query: tab.query,
        variableValues: tab.variableValues,
        loading: false,
        queryExecutionId: undefined,
      });
    } finally {
      pendingQueryIdsRef.current.delete(queryExecutionId);
      forgetCanceledQuery(queryExecutionId);
    }
  };

  const onScrollEnd = async (idTab: string) => {
    const lastTabResult = querysResultData.get(idTab);

    if (!lastTabResult || lastTabResult.loading || !lastTabResult.auto_paginated) return;

    const query = lastTabResult.query;
    const preparedQuery = prepareQueryVariables(query, lastTabResult.variableValues);
    const newPage = (lastTabResult.page || 1) + 1;
    const columnTypes = getResultExecution(idTab)?.isCurrent() ? lastTabResult.columns_info?.map(({ name, type }) => ({ name, type })) : undefined;
    const queryExecutionId = generateHash();
    const execution = beginResultExecution({ idTab, queryExecutionId });
    if (!execution) return;
    const updateTabResultData = execution.update;
    pendingQueryIdsRef.current.add(queryExecutionId);

    updateTabResultData({
      loading: true,
      queryExecutionId,
      date_run: new Date().toISOString(),
    });

    try {
      const [
        { type, rows, columns, columns_info, column_sources_resolved, supports_row_management, row_management_table, affected_rows, auto_paginated, execution_time_ms },
      ] = await runSql(id_connection, preparedQuery, {
        page: newPage,
        orderBy: lastTabResult.orderBy,
        columnTypes,
        queryExecutionId,
      });

      const canceled = wasQueryCanceled(queryExecutionId);
      if (!execution.isCurrent()) return;
      if (canceled) {
        updateTabResultData(
          makeCanceledQueryResult(t('toast.queryCanceled'), {
            query,
            variableValues: lastTabResult.variableValues,
          }),
        );
        return;
      }

      updateTabResultData({
        page: newPage,
        columns,
        columns_info,
        column_sources_resolved,
        supports_row_management,
        row_management_table,
        rows: [...lastTabResult.rows, ...rows],
        type,
        query,
        variableValues: lastTabResult.variableValues,
        affected_rows,
        auto_paginated,
        loading: false,
        execution_time_ms,
        queryExecutionId: undefined,
      });
    } catch (error) {
      const canceled = wasQueryCanceled(queryExecutionId);
      if (!execution.isCurrent()) return;
      if (canceled) {
        updateTabResultData(
          makeCanceledQueryResult(t('toast.queryCanceled'), {
            query,
            variableValues: lastTabResult.variableValues,
          }),
        );
        return;
      }

      const message = formatQueryErrorMessage(error, t('common.unknownErrorNoDot'));
      updateTabResultData({
        type: 'ERROR',
        query,
        variableValues: lastTabResult.variableValues,
        message,
        loading: false,
        queryExecutionId: undefined,
      });
    } finally {
      pendingQueryIdsRef.current.delete(queryExecutionId);
      forgetCanceledQuery(queryExecutionId);
    }
  };

  const handleSortQueryResult = async (
    idTab: string,
    columnName: string,
    sortType?: ISortDirection | null,
  ) => {
    const tab = querysResultData.get(idTab);
    if (!tab || tab.loading) return;

    const orderBy = getNextSort(tab.orderBy, columnName, sortType);
    const preparedQuery = prepareQueryVariables(tab.query, tab.variableValues);
    const columnTypes = getResultExecution(idTab)?.isCurrent() ? tab.columns_info?.map(({ name, type }) => ({ name, type })) : undefined;
    const queryExecutionId = generateHash();
    const execution = beginResultExecution({ idTab, queryExecutionId });
    if (!execution) return;
    const updateTabResultData = execution.update;
    pendingQueryIdsRef.current.add(queryExecutionId);

    updateTabResultData({
      loading: true,
      orderBy,
      queryExecutionId,
      resultRevision: queryExecutionId,
      date_run: new Date().toISOString(),
    });

    try {
      const [
        { type, rows, columns, columns_info, column_sources_resolved, supports_row_management, row_management_table, affected_rows, auto_paginated, execution_time_ms },
      ] = await runSql(id_connection, preparedQuery, {
        page: 1,
        orderBy,
        columnTypes,
        queryExecutionId,
      });

      const canceled = wasQueryCanceled(queryExecutionId);
      if (!execution.isCurrent()) return;
      if (canceled) {
        updateTabResultData(makeCanceledQueryResult(t('toast.queryCanceled'), tab));
        return;
      }

      updateTabResultData({
        page: 1,
        columns,
        columns_info,
        column_sources_resolved,
        supports_row_management,
        row_management_table,
        rows,
        type,
        query: tab.query,
        variableValues: tab.variableValues,
        affected_rows,
        auto_paginated,
        execution_time_ms,
        loading: false,
        orderBy,
        queryExecutionId: undefined,
      });
    } catch (error) {
      const canceled = wasQueryCanceled(queryExecutionId);
      if (!execution.isCurrent()) return;
      if (canceled) {
        updateTabResultData(makeCanceledQueryResult(t('toast.queryCanceled'), tab));
        return;
      }

      const message = formatQueryErrorMessage(error, t('common.unknownErrorNoDot'));
      updateTabResultData({ type: 'ERROR', message, loading: false, queryExecutionId: undefined });
    } finally {
      pendingQueryIdsRef.current.delete(queryExecutionId);
      forgetCanceledQuery(queryExecutionId);
    }
  };

  return {
    cancelingQueryIds,
    executeQuery,
    executeExplainQuery,
    cancelResultQuery,
    refreshResultSqlTab,
    onScrollEnd,
    handleSortQueryResult,
  };
};
