import React from 'react';
import useStorage from '@renderer/hooks/useStorage';
import { hasUnsafeSqlMutation } from '@renderer/utils/sql';
import type { ExportDataSource } from '@shared/types/database';
import { getQueryVariables, prepareQueryVariables } from '../utils/queryVariables';
import type { IExecuteQueryParams, IPendingQueryExecution } from '../dtos';

interface QueryRequestsOptions {
  id_connection: string;
  isProductionConnection: boolean;
  executeQuery: (params: IExecuteQueryParams) => Promise<void>;
  executeExplainQuery: (params: IExecuteQueryParams) => Promise<void>;
}

export const useQueryRequests = ({
  id_connection,
  isProductionConnection,
  executeQuery,
  executeExplainQuery,
}: QueryRequestsOptions) => {
  const [queryVariableValuesByConnection, setQueryVariableValuesByConnection] = useStorage<
    Record<string, Record<string, string>>
  >('query_editor_variable_values', {});

  const [pendingQueryExecution, setPendingQueryExecution] =
    React.useState<IPendingQueryExecution>();

  const [pendingExportQuery, setPendingExportQuery] = React.useState<string>();

  const [exportQuerySource, setExportQuerySource] = React.useState<ExportDataSource>();

  const [pendingProductionQueryExecution, setPendingProductionQueryExecution] =
    React.useState<IExecuteQueryParams>();

  const confirmOrExecuteQuery = (params: IExecuteQueryParams) => {
    if (params.mode === 'explain') {
      executeExplainQuery(params);
      return;
    }

    const preparedQuery = prepareQueryVariables(params.query, params.variableValues);

    if (isProductionConnection && hasUnsafeSqlMutation(preparedQuery)) {
      setPendingProductionQueryExecution(params);
      return;
    }

    executeQuery(params);
  };

  const requestQueryExecution = (params: IPendingQueryExecution) => {
    const variables = getQueryVariables(params.query);

    if (variables.length) {
      setPendingQueryExecution(params);
      return;
    }

    confirmOrExecuteQuery(params);
  };

  const closeVariablesModal = React.useCallback(() => {
    setPendingQueryExecution(undefined);
  }, []);

  const closeExportVariablesModal = React.useCallback(() => {
    setPendingExportQuery(undefined);
  }, []);

  const closeExportModal = React.useCallback(() => {
    setExportQuerySource(undefined);
  }, []);

  const closeProductionConfirmModal = React.useCallback(() => {
    setPendingProductionQueryExecution(undefined);
  }, []);

  const queryVariableInitialValues = React.useMemo(
    () => queryVariableValuesByConnection[id_connection] || {},
    [id_connection, queryVariableValuesByConnection],
  );

  const pendingQueryVariables = React.useMemo(() => {
    return getQueryVariables(pendingQueryExecution?.query || '');
  }, [pendingQueryExecution?.query]);

  const pendingExportQueryVariables = React.useMemo(() => {
    return getQueryVariables(pendingExportQuery || '');
  }, [pendingExportQuery]);

  const pendingProductionSql = React.useMemo(() => {
    return pendingProductionQueryExecution
      ? prepareQueryVariables(
          pendingProductionQueryExecution.query,
          pendingProductionQueryExecution.variableValues,
        )
      : '';
  }, [pendingProductionQueryExecution]);

  const executePendingQuery = (variableValues: Record<string, string>) => {
    if (!pendingQueryExecution) return;

    setQueryVariableValuesByConnection((prevState) => ({
      ...prevState,
      [id_connection]: {
        ...(prevState[id_connection] || {}),
        ...variableValues,
      },
    }));

    const params = { ...pendingQueryExecution, variableValues };
    setPendingQueryExecution(undefined);
    confirmOrExecuteQuery(params);
  };

  const openExportModalFromQuery = React.useCallback((query: string) => {
    if (!query?.trim?.()) return;

    const variables = getQueryVariables(query);

    if (variables.length) {
      setPendingExportQuery(query);
      return;
    }

    setExportQuerySource({ type: 'query', sql: query });
  }, []);

  const exportPendingQuery = (variableValues: Record<string, string>) => {
    if (!pendingExportQuery) return;

    setQueryVariableValuesByConnection((prevState) => ({
      ...prevState,
      [id_connection]: {
        ...(prevState[id_connection] || {}),
        ...variableValues,
      },
    }));

    setExportQuerySource({
      type: 'query',
      sql: prepareQueryVariables(pendingExportQuery, variableValues),
    });
    setPendingExportQuery(undefined);
  };

  const executePendingProductionQuery = () => {
    if (!pendingProductionQueryExecution) return;

    const params = pendingProductionQueryExecution;
    setPendingProductionQueryExecution(undefined);
    executeQuery(params);
  };

  return {
    pendingQueryExecution,
    pendingExportQuery,
    exportQuerySource,
    pendingProductionQueryExecution,
    requestQueryExecution,
    closeVariablesModal,
    closeExportVariablesModal,
    closeExportModal,
    closeProductionConfirmModal,
    queryVariableInitialValues,
    pendingQueryVariables,
    pendingExportQueryVariables,
    pendingProductionSql,
    executePendingQuery,
    openExportModalFromQuery,
    exportPendingQuery,
    executePendingProductionQuery,
  };
};
