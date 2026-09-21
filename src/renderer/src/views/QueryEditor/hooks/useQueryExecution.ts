import type React from 'react';
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
    'resultActiveTabId' | 'querysResultData' | 'makeNewTabResult' | 'makeUpdateResultTab'
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
  const { resultActiveTabId: activeTabId, querysResultData, makeNewTabResult, makeUpdateResultTab } = results;
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
    const queryExecutionId = generateHash();

    const updateTabResultData =
      !forceNewTab && !openNewTab && activeTabId
        ? makeUpdateResultTab(activeTabId)
        : makeNewTabResult({
            query,
            variableValues,
            type: 'SELECT',
            date_run: new Date().toISOString(),
          });

    updateTabResultData({
      type: 'SELECT',
      loading: true,
      queryExecutionId,
      date_run: new Date().toISOString(),
    });

    try {
      refEditor.current.setMarkers([]);

      const [
        { type, rows, columns, columns_info, affected_rows, auto_paginated, execution_time_ms },
      ] = await runSql(id_connection, preparedQuery, { queryExecutionId });

      if (wasQueryCanceled(queryExecutionId)) {
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
        rows,
        type,
        affected_rows,
        auto_paginated,
        execution_time_ms,
        loading: false,
        queryExecutionId: undefined,
      });
    } catch (error) {
      if (wasQueryCanceled(queryExecutionId)) {
        updateTabResultData(
          makeCanceledQueryResult(t('toast.queryCanceled'), { query, variableValues }),
        );
        return;
      }

      const message = formatQueryExecutionErrorMessage(error, markErrors);

      updateTabResultData({
        type: 'ERROR',
        query,
        variableValues,
        message,
        loading: false,
        queryExecutionId: undefined,
      });

      const errorOffset = getQueryErrorOffset(error);

      if (errorOffset === undefined) return;

      const editorQueryStartOffset = params.editorOffset || 0;
      const errorPosition = refEditor.current.getPositionAt(editorQueryStartOffset + errorOffset);
      const endPosition = refEditor.current.getPositionAt(editorQueryStartOffset + query.length);

      if (!errorPosition || !endPosition) return;

      refEditor.current.setMarkers([makeQueryErrorMarker(message, errorPosition, endPosition)]);
      refEditor.current.setPosition(errorPosition);
    }
  };

  const executeExplainQuery = async (params: IExecuteQueryParams) => {
    const { query, variableValues } = params;
    const preparedQuery = prepareQueryVariables(query, variableValues);
    const dialectId = dialect;
    const queryExecutionId = generateHash();

    const updateTabResultData = makeNewTabResult({
      query,
      variableValues,
      type: 'EXPLAIN',
      title: t('query.explainTabTitle'),
      date_run: new Date().toISOString(),
      explain: {
        dialect: dialectId,
        originalQuery: query,
      },
    });

    updateTabResultData({
      type: 'EXPLAIN',
      loading: true,
      queryExecutionId,
      date_run: new Date().toISOString(),
    });

    try {
      const [result] = await runExplainSql(id_connection, preparedQuery, {
        queryExecutionId,
      });

      if (wasQueryCanceled(queryExecutionId)) {
        updateTabResultData(
          makeCanceledQueryResult(t('toast.queryCanceled'), { query, variableValues }),
        );
        return;
      }

      updateTabResultData({
        ...result,
        type: 'EXPLAIN',
        query,
        variableValues,
        loading: false,
        queryExecutionId: undefined,
        explain: {
          dialect: dialectId,
          originalQuery: query,
        },
      });
    } catch (error) {
      if (wasQueryCanceled(queryExecutionId)) {
        updateTabResultData(
          makeCanceledQueryResult(t('toast.queryCanceled'), { query, variableValues }),
        );
        return;
      }

      updateTabResultData({
        type: 'ERROR',
        query,
        variableValues,
        message: formatQueryExecutionErrorMessage(error),
        loading: false,
        queryExecutionId: undefined,
      });
    }
  };

  const cancelResultQuery = async (idTab: string) => {
    const tab = querysResultData.get(idTab);

    if (!tab?.loading || !tab.queryExecutionId) return;

    markQueryCanceling(tab.queryExecutionId);

    let canceled = false;

    try {
      canceled = await cancelRunSql(id_connection, tab.queryExecutionId);

      if (canceled) {
        makeUpdateResultTab(idTab)(makeCanceledQueryResult(t('toast.queryCanceled')));
      }
    } finally {
      if (!canceled) forgetCanceledQuery(tab.queryExecutionId);
      removeCancelingQueryId(tab.queryExecutionId);
    }
  };

  const refreshResultSqlTab = async (idTab: string) => {
    const tab = querysResultData.get(idTab);
    const updateTabResultData = makeUpdateResultTab(idTab);
    const preparedQuery = prepareQueryVariables(tab.query, tab.variableValues);
    const queryExecutionId = generateHash();

    updateTabResultData({
      loading: true,
      queryExecutionId,
      date_run: new Date().toISOString(),
    });

    try {
      const [
        { type, rows, columns, columns_info, affected_rows, auto_paginated, execution_time_ms },
      ] = await runSql(id_connection, preparedQuery, {
        orderBy: tab.orderBy,
        queryExecutionId,
      });

      if (wasQueryCanceled(queryExecutionId)) {
        updateTabResultData(makeCanceledQueryResult(t('toast.queryCanceled'), tab));
        return;
      }

      updateTabResultData({
        page: 1,
        columns,
        columns_info,
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
      if (wasQueryCanceled(queryExecutionId)) {
        updateTabResultData(makeCanceledQueryResult(t('toast.queryCanceled'), tab));
        return;
      }

      const message = formatQueryErrorMessage(error);
      updateTabResultData({
        type: 'ERROR',
        message,
        query: tab.query,
        variableValues: tab.variableValues,
        loading: false,
        queryExecutionId: undefined,
      });
    }
  };

  const onScrollEnd = async (idTab: string) => {
    const lastTabResult = querysResultData.get(idTab);

    if (!lastTabResult || lastTabResult.loading || !lastTabResult.auto_paginated) return;

    const updateTabResultData = makeUpdateResultTab(idTab);

    const query = lastTabResult.query;
    const preparedQuery = prepareQueryVariables(query, lastTabResult.variableValues);
    const newPage = (lastTabResult.page || 1) + 1;
    const queryExecutionId = generateHash();

    updateTabResultData({
      loading: true,
      queryExecutionId,
      date_run: new Date().toISOString(),
    });

    try {
      const [
        { type, rows, columns, columns_info, affected_rows, auto_paginated, execution_time_ms },
      ] = await runSql(id_connection, preparedQuery, {
        page: newPage,
        orderBy: lastTabResult.orderBy,
        queryExecutionId,
      });

      if (wasQueryCanceled(queryExecutionId)) {
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
      if (wasQueryCanceled(queryExecutionId)) {
        updateTabResultData(
          makeCanceledQueryResult(t('toast.queryCanceled'), {
            query,
            variableValues: lastTabResult.variableValues,
          }),
        );
        return;
      }

      const message = formatQueryErrorMessage(error);
      updateTabResultData({
        type: 'ERROR',
        query,
        variableValues: lastTabResult.variableValues,
        message,
        loading: false,
        queryExecutionId: undefined,
      });
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
    const updateTabResultData = makeUpdateResultTab(idTab);
    const preparedQuery = prepareQueryVariables(tab.query, tab.variableValues);
    const queryExecutionId = generateHash();

    updateTabResultData({
      loading: true,
      orderBy,
      queryExecutionId,
      date_run: new Date().toISOString(),
    });

    try {
      const [
        { type, rows, columns, columns_info, affected_rows, auto_paginated, execution_time_ms },
      ] = await runSql(id_connection, preparedQuery, {
        page: 1,
        orderBy,
        queryExecutionId,
      });

      if (wasQueryCanceled(queryExecutionId)) {
        updateTabResultData(makeCanceledQueryResult(t('toast.queryCanceled'), tab));
        return;
      }

      updateTabResultData({
        page: 1,
        columns,
        columns_info,
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
      if (wasQueryCanceled(queryExecutionId)) {
        updateTabResultData(makeCanceledQueryResult(t('toast.queryCanceled'), tab));
        return;
      }

      const message = formatQueryErrorMessage(error);
      updateTabResultData({ type: 'ERROR', message, loading: false, queryExecutionId: undefined });
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
