import React from 'react';
import Editor, { IEditorRef, type IEditorContextMenu } from '@renderer/components/Editor';
import styles from './styles.module.css';
import {
  TabBar,
  TabContent,
  TabWindow,
  type IActiveTabContextMenu,
} from '@renderer/components/Tabs';
import { useTabContentContext } from '@renderer/components/Tabs/components/TabContentProvider';
import type { IContextMenuOption } from '@renderer/components/ContextMenu';
import { generateHash } from '@renderer/utils/string';
import ResizableContainer, { type OnResizeCallback } from '@renderer/components/ResizableContainer';
import useDebounce from '@renderer/hooks/useDebounce';
import useStorage from '@renderer/hooks/useStorage';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { ITab } from '@renderer/components/Tabs/components/TabBar';
import {
  IColumnInfo,
  IColumnReferenceInfo,
  IServerOutputMessage,
  type ExportDataSource,
  useStoreContext,
} from '@renderer/contexts/Store';
import { getTablesFromQuerySql, hasUnsafeSqlMutation, ITableQuery } from '@renderer/utils/sql';
import { isSnippetAvailableForDialect } from '@renderer/utils/snippets';
import { getNextSort } from '@renderer/utils/tableSort';
import { arrayIsEquals } from '@renderer/utils/array';
import { executePromisesBatch } from '@renderer/utils/promise';
import { IDefineSQlAutocompleteParams } from '@renderer/components/Editor/autocompleteDefault';
import useEditorCtrlClickNavigate from '@renderer/hooks/useEditorCtrlClickNavigate';
import { ModalQueryVariables } from './components/ModalQueryVariables';
import { ModalConfirmProductionQuery } from './components/ModalConfirmProductionQuery';
import { getQueryVariables, prepareQueryVariables } from './utils/queryVariables';
import {
  formatQueryErrorMessage,
  formatQueryExecutionErrorMessage,
  getCaptureRowHash,
  getQueryErrorOffset,
  makeQueryErrorMarker,
  makeCanceledQueryResult,
} from './utils/queryResult';
import { isPrimaryShortcutPressed } from '@renderer/utils/keyboard';
import type { ISortDirection } from '@renderer/components/Table/dtos';
import type {
  IDataMakeTabResult,
  IDataUpdateabResult,
  IExecuteQueryParams,
  IPendingQueryExecution,
  IQueryEditorProps,
  IQueryResult,
} from './dtos';

import { LateralBar } from './components/LateralBar';
import { TabContentDelete } from './components/TabContentDelete';
import { TabContentAlter } from './components/TabContentAlter';
import { TabcontentError } from './components/TabContentError';
import { TabContentGeneric } from './components/TabContentGeneric';
import { TabContentSelect } from './components/TabContentSelect';
import { ModalServerOutput } from './components/ModalServerOutput';
import { getRendererDialect } from '@renderer/database/dialects';
import { useQueryCancellation } from './hooks/useQueryCancellation';
import { TabContentExplain } from './components/TabContentExplain';
import { ModalExportData } from '@renderer/components/ModalExportData';

export const QueryEditor = ({ id_connection, id_script }: IQueryEditorProps) => {
  const { t } = useI18n();
  const {
    runSql,
    cancelRunSql,
    connections,
    connectionsInfo,
    getTableColumns,
    getTableReferences,
    editScript,
    getScriptContent,
    runExplainSql,
    snippets,
  } = useStoreContext();

  const { activeTheme } = useThemeContext();
  const { isActiveTab } = useTabContentContext();
  const handleEditorCtrlClick = useEditorCtrlClickNavigate(id_connection);
  const currentConnection = React.useMemo(
    () => connections.find((connection) => connection.id === id_connection),
    [connections, id_connection],
  );
  const dialect = getRendererDialect(currentConnection?.dialect);
  const isProductionConnection = currentConnection?.environment === 'production';

  const id = React.useMemo(() => generateHash(), []);
  const refEditor = React.useRef<IEditorRef>(null);
  const loadingColumnsKeysRef = React.useRef(new Set<string>());
  const loadingReferencesKeysRef = React.useRef(new Set<string>());
  const [activeTabId, setActiveTabId] = React.useState<string>(null);
  const [sizeTabContent, _setSizeTabContent] = useStorage('editor_tab_result_height', 240);
  const [queryVariableValuesByConnection, setQueryVariableValuesByConnection] = useStorage<
    Record<string, Record<string, string>>
  >('query_editor_variable_values', {});
  const setSizeTabContent = useDebounce(_setSizeTabContent);

  const [currentQueryTablesInfo, setCurrentQueryTablesInfo] = React.useState<ITableQuery[]>([]);
  const [tableColumns, setTableColumns] = React.useState<Map<string, IColumnInfo[]>>(new Map());
  const [tableReferences, setTableReferences] = React.useState<Map<string, IColumnReferenceInfo[]>>(
    new Map(),
  );
  const [tabsResult, setTabsResult] = React.useState<ITab[]>([]);
  const [querysResultData, setQuerysResultData] = React.useState<Map<React.Key, IQueryResult>>(
    new Map(),
  );
  const [pendingQueryExecution, setPendingQueryExecution] =
    React.useState<IPendingQueryExecution>();
  const [pendingExportQuery, setPendingExportQuery] = React.useState<string>();
  const [exportQuerySource, setExportQuerySource] = React.useState<ExportDataSource>();
  const [pendingProductionQueryExecution, setPendingProductionQueryExecution] =
    React.useState<IExecuteQueryParams>();
  const [showServerOutputModal, setShowServerOutputModal] = React.useState(false);
  const [hasUnreadServerOutput, setHasUnreadServerOutput] = React.useState(false);
  const {
    cancelingQueryIds,
    forgetCanceledQuery,
    markQueryCanceling,
    removeCancelingQueryId,
    wasQueryCanceled,
  } = useQueryCancellation();
  const tableColumnsRef = React.useRef(tableColumns);
  tableColumnsRef.current = tableColumns;
  const tableReferencesRef = React.useRef(tableReferences);
  tableReferencesRef.current = tableReferences;

  const makeUpdateResultTab = React.useCallback((idTab: string) => {
    const updateTabResultData = (params: IDataUpdateabResult) => {
      setQuerysResultData((prevState) => {
        const newMap = new Map(prevState);

        const prevTabResultData = prevState.get(idTab) || ({} as IQueryResult);
        const { captureRows, ...dataParams } = params;
        const queryChanged =
          typeof dataParams.query === 'string' &&
          !!prevTabResultData.query &&
          dataParams.query !== prevTabResultData.query;
        const baseTabResultData = queryChanged
          ? { ...prevTabResultData, capture: undefined }
          : prevTabResultData;
        const newTabResultData = { ...baseTabResultData, ...dataParams };

        if (captureRows && newTabResultData.capture?.active && Array.isArray(dataParams.rows)) {
          const rowHashes = new Set(newTabResultData.capture.rowHashes);
          const capturedRows = dataParams.rows.flatMap((row) => {
            const rowHash = getCaptureRowHash(row);

            if (rowHashes.has(rowHash)) return [];

            rowHashes.add(rowHash);

            return [{ captured_at: new Date().toISOString(), row }];
          });

          newTabResultData.capture = {
            ...newTabResultData.capture,
            rows: [...newTabResultData.capture.rows, ...capturedRows],
            rowHashes: [...rowHashes],
          };
        }

        newTabResultData.tables_info = getTablesFromQuerySql(newTabResultData.query);

        newMap.set(idTab, newTabResultData);

        return newMap;
      });
    };

    return updateTabResultData;
  }, []);

  const makeNewTabResult = React.useCallback((data: IDataMakeTabResult) => {
    const {
      loading,
      type,
      columns = [],
      rows = [],
      columns_info,
      query,
      affected_rows,
      page,
      title = `Result ${tabsResult.length + 1}`,
      variableValues,
      queryExecutionId,
    } = data;

    const idTab = generateHash();

    const tab: ITab = {
      idTab,
      title,
    };

    const queryResultData: IQueryResult = {
      type,
      columns,
      rows,
      loading,
      query,
      page,
      affected_rows,
      columns_info,
      tables_info: getTablesFromQuerySql(query),
      variableValues,
      queryExecutionId,
    };

    setTabsResult((prevState) => [...prevState, tab]);
    setActiveTabId(idTab);

    const updateTabResultData = makeUpdateResultTab(idTab);

    updateTabResultData(queryResultData);

    return updateTabResultData;
  }, [makeUpdateResultTab, tabsResult.length]);

  const removeTabResult = React.useCallback((idTab: string | string[]) => {
    const tabsIdToRemove = new Set(Array.isArray(idTab) ? idTab : [idTab]);

    setTabsResult((prevState) => {
      if (activeTabId && tabsIdToRemove.has(activeTabId)) {
        const activeTabIndex = prevState.findIndex((tab) => tab.idTab === activeTabId);
        const nextTab =
          prevState.slice(activeTabIndex + 1).find((tab) => !tabsIdToRemove.has(tab.idTab)) ||
          prevState
            .slice(0, activeTabIndex)
            .reverse()
            .find((tab) => !tabsIdToRemove.has(tab.idTab));

        setActiveTabId(nextTab?.idTab || null);
      }

      return prevState.filter((tab) => !tabsIdToRemove.has(tab.idTab));
    });

    setQuerysResultData((prevState) => {
      const newMap = new Map(prevState);

      tabsIdToRemove.forEach((id) => newMap.delete(id));

      return newMap;
    });
  }, [activeTabId]);

  const getSelectionsValues = () => {
    const selections = refEditor.current?.getSelections?.();

    const selectionsValue = selections
      ?.map?.((selection) => {
        return refEditor.current?.getSelectionValue?.(selection) || '';
      })
      .filter((value) => value?.trim?.());

    return selectionsValue;
  };

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
    const dialectId = currentConnection?.dialect || 'postgres';
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

  const showServerOutput = React.useCallback(() => {
    setHasUnreadServerOutput(false);
    setShowServerOutputModal(true);
  }, []);

  const closeServerOutput = React.useCallback(() => {
    setShowServerOutputModal(false);
  }, []);

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

    setExportQuerySource({ type: 'query', sql: prepareQueryVariables(pendingExportQuery, variableValues) });
    setPendingExportQuery(undefined);
  };

  const executePendingProductionQuery = () => {
    if (!pendingProductionQueryExecution) return;

    const params = pendingProductionQueryExecution;
    setPendingProductionQueryExecution(undefined);
    executeQuery(params);
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

  const toggleResultCapture = (idTab: string) => {
    const tab = querysResultData.get(idTab);

    if (!tab) return;

    const date = new Date().toISOString();
    const updateTabResultData = makeUpdateResultTab(idTab);

    if (tab.capture?.active) {
      updateTabResultData({
        capture: {
          ...tab.capture,
          active: false,
          stopped_at: date,
        },
      });
      return;
    }

    if (tab.capture) {
      updateTabResultData({
        capture: {
          ...tab.capture,
          active: true,
          stopped_at: undefined,
          rowHashes: [
            ...new Set([...tab.capture.rowHashes, ...(tab.rows || []).map(getCaptureRowHash)]),
          ],
        },
      });
      return;
    }

    updateTabResultData({
      capture: {
        active: true,
        started_at: date,
        rows: [],
        rowHashes: (tab.rows || []).map(getCaptureRowHash),
      },
    });
  };

  const clearResultCapture = (idTab: string) => {
    makeUpdateResultTab(idTab)({ capture: undefined });
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

  const runCurrentSQL = async (openNewTab?: boolean) => {
    const selections = refEditor.current?.getSelections?.() || [];
    const selectionsValue = getSelectionsValues();
    const firstSelectionPosition = selections
      .find((selection) => refEditor.current?.getSelectionValue?.(selection)?.trim?.())
      ?.getStartPosition?.();
    const selectionOffset = firstSelectionPosition
      ? refEditor.current?.getOffsetAt?.(firstSelectionPosition)
      : undefined;

    if (selectionsValue.length) {
      const query = selectionsValue.join('\n');
      requestQueryExecution({ query, editorOffset: selectionOffset, openNewTab });
      return;
    }

    const currentQuery = refEditor.current?.getCurrentQueryRange?.();
    const query = currentQuery?.sql;

    if (!query) return;

    requestQueryExecution({ query, editorOffset: currentQuery.start, openNewTab });
  };

  const explainCurrentSQL = async () => {
    const selections = refEditor.current?.getSelections?.() || [];
    const selectionsValue = getSelectionsValues();
    const firstSelectionPosition = selections
      .find((selection) => refEditor.current?.getSelectionValue?.(selection)?.trim?.())
      ?.getStartPosition?.();
    const selectionOffset = firstSelectionPosition
      ? refEditor.current?.getOffsetAt?.(firstSelectionPosition)
      : undefined;

    if (selectionsValue.length) {
      const query = selectionsValue.join('\n');
      requestQueryExecution({
        query,
        editorOffset: selectionOffset,
        forceNewTab: true,
        mode: 'explain',
      });
      return;
    }

    const currentQuery = refEditor.current?.getCurrentQueryRange?.();
    const query = currentQuery?.sql;

    if (!query) return;

    requestQueryExecution({
      query,
      editorOffset: currentQuery.start,
      forceNewTab: true,
      mode: 'explain',
    });
  };

  const runSelectionsSQL = async () => {
    const selections = refEditor.current?.getSelections?.() || [];
    const selectionsValue = getSelectionsValues();
    const query = selectionsValue.join('\n');
    const firstSelectionPosition = selections
      .find((selection) => refEditor.current?.getSelectionValue?.(selection)?.trim?.())
      ?.getStartPosition?.();
    const selectionOffset = firstSelectionPosition
      ? refEditor.current?.getOffsetAt?.(firstSelectionPosition)
      : undefined;

    if (!query) return;

    requestQueryExecution({ query, editorOffset: selectionOffset, forceNewTab: true });
  };

  const runAllSQL = async () => {
    const query = refEditor.current?.getValue?.();

    if (!query) return;

    requestQueryExecution({ query, editorOffset: 0, forceNewTab: true, markErrors: true });
  };

  const onScrollEnd = async () => {
    const lastTabResult = querysResultData.get(activeTabId);

    if (!lastTabResult || lastTabResult.loading || !lastTabResult.auto_paginated) return;

    const updateTabResultData = makeUpdateResultTab(activeTabId);

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

  const getTableInfoKey = ({ name, schema }: ITableQuery) => `${schema ? schema + '.' : ''}${name}`;

  const loadTableColumns = React.useCallback(async () => {
    const pendingTables = new Map<string, ITableQuery>();

    for (const tableInfo of currentQueryTablesInfo) {
      const key = getTableInfoKey(tableInfo);

      const isPending = !tableColumnsRef.current.has(key) && !loadingColumnsKeysRef.current.has(key);

      if (isPending) {
        loadingColumnsKeysRef.current.add(key);
        pendingTables.set(key, tableInfo);
      }
    }

    if (!pendingTables.size) return;

    try {
      const results = await executePromisesBatch(
        [...pendingTables.entries()],
        async ([key, tableInfo]) => {
          const columns = await getTableColumns(id_connection, {
            schema: tableInfo.schema,
            table: tableInfo.name,
          });

          return { key, columns };
        },
      );

      setTableColumns((prevState) => {
        const newState = new Map(prevState);
        results.forEach(({ key, columns }) => newState.set(key, columns));
        return newState;
      });
    } finally {
      pendingTables.forEach((_, key) => loadingColumnsKeysRef.current.delete(key));
    }
  }, [currentQueryTablesInfo, getTableColumns, id_connection]);

  const loadTableReferences = React.useCallback(async () => {
    const pendingTables = new Map<string, ITableQuery>();

    for (const tableInfo of currentQueryTablesInfo) {
      const key = getTableInfoKey(tableInfo);

      const isPending =
        !tableReferencesRef.current.has(key) && !loadingReferencesKeysRef.current.has(key);

      if (isPending) {
        loadingReferencesKeysRef.current.add(key);
        pendingTables.set(key, tableInfo);
      }
    }

    if (!pendingTables.size) return;

    try {
      const results = await executePromisesBatch(
        [...pendingTables.entries()],
        async ([key, tableInfo]) => {
          const references = await getTableReferences(id_connection, {
            schema: tableInfo.schema,
            table: tableInfo.name,
          });

          return { key, references };
        },
      );

      setTableReferences((prevState) => {
        const newState = new Map(prevState);
        results.forEach(({ key, references }) => newState.set(key, references));
        return newState;
      });
    } finally {
      pendingTables.forEach((_, key) => loadingReferencesKeysRef.current.delete(key));
    }
  }, [currentQueryTablesInfo, getTableReferences, id_connection]);

  const loadScriptContent = async () => {
    if (!id_script) return;

    const content = await getScriptContent(id_script);

    if (content) refEditor.current?.setValue?.(content);
  };

  const saveScript = useDebounce(() => {
    if (!id_script) return;

    const content = refEditor.current?.getValue();

    editScript(id_script, { content, updated_at: new Date().toISOString() });
  }, 1000);

  const clearEditorErrorMarkers = React.useCallback(() => {
    refEditor.current?.setMarkers?.([]);
  }, []);

  const handleUpdateCurrentQueryInfo = React.useCallback((query: string) => {
    const tablesQueryInfo = getTablesFromQuerySql(query);

    setCurrentQueryTablesInfo((prevState) => {
      // avoid changing the state memory address if there are no changes (prevent rerendering)
      const checkIsEquals = arrayIsEquals(prevState, tablesQueryInfo);
      return checkIsEquals ? prevState : tablesQueryInfo;
    });
  }, []);

  const autocomplete = React.useMemo<IDefineSQlAutocompleteParams>(() => {
    const snippetsAvailable = snippets.filter((snippet) =>
      isSnippetAvailableForDialect(snippet, currentConnection?.dialect),
    );
    const connectionInfo = connectionsInfo.get(id_connection);

    if (!connectionInfo) return { snippets: snippetsAvailable };

    const schemas = connectionInfo.schemas || [];
    const tables = connectionInfo.tables || [];
    const functions = connectionInfo.functions || [];

    const schemasSerialized = schemas.map((schema) => ({ name: schema }));
    const tablesAvailable = tables.map((table) => ({
      name: table.table_name,
      schema: table.table_schema,
    }));
    const functionsAvailable = functions.map((fn) => ({
      name: fn.function_name,
      schema: fn.function_schema,
    }));
    const tablesUsed = currentQueryTablesInfo;

    const columns = [];

    tablesUsed.forEach((tableInfo) => {
      const { name: table, schema } = tableInfo;
      const key = `${schema ? schema + '.' : ''}${table}`;

      tableColumns
        .get(key)
        ?.forEach?.((column) => columns.push({ name: column.column_name, table, schema }));
    });

    return {
      schemas: schemasSerialized,
      tablesAvailable,
      tablesUsed,
      columns,
      functions: functionsAvailable,
      snippets: snippetsAvailable,
    };
  }, [
    connectionsInfo,
    currentConnection?.dialect,
    currentQueryTablesInfo,
    id_connection,
    snippets,
    tableColumns,
  ]);

  const contextMenuOptions = React.useMemo<IContextMenuOption<IActiveTabContextMenu>[]>(
    () => [
      {
        text: 'Fechar aba',
        onClick: (info) => removeTabResult(info.tab.idTab),
      },
      tabsResult.length > 1 && {
        text: 'Fechar outras abas',
        onClick: (info) => {
          setActiveTabId(info.tab.idTab);
          removeTabResult(
            tabsResult.filter((tab) => tab.idTab !== info.tab.idTab).map((tab) => tab.idTab),
          );
        },
      },
      tabsResult.length > 1 && {
        text: 'Fechar abas à esquerda',
        onClick: (info) => {
          removeTabResult(tabsResult.slice(0, info.index).map((tab) => tab.idTab));
        },
      },
      tabsResult.length > 1 && {
        text: 'Fechar abas à direita',
        onClick: (info) => {
          removeTabResult(tabsResult.slice(info.index + 1).map((tab) => tab.idTab));
        },
      },
      tabsResult.length > 1 && {
        text: 'Fechar todas as abas',
        onClick: () => removeTabResult(tabsResult.map((tab) => tab.idTab)),
      },
    ],
    [removeTabResult, setActiveTabId, tabsResult],
  );

  const editorContextMenuOptions = React.useMemo<IContextMenuOption<IEditorContextMenu>[]>(
    () => [
      {
        text: t('context.exportSelectedSqlResult'),
        show: (info) => !!info?.selectedText,
        onClick: (info) => openExportModalFromQuery(info?.selectedText || ''),
      },
    ],
    [openExportModalFromQuery, t],
  );

  const handleRemoveResultTab = React.useCallback(
    (tab: ITab) => {
      removeTabResult(tab.idTab);
    },
    [removeTabResult],
  );

  const handleResizeResultTabs = React.useCallback<OnResizeCallback>(
    (size) => {
      setSizeTabContent(size.height);
    },
    [setSizeTabContent],
  );

  const handleActiveResultTab = React.useCallback((tab: ITab) => {
    setActiveTabId(tab?.idTab);
  }, []);

  const runAllRef = React.useRef(runAllSQL);
  runAllRef.current = runAllSQL;

  const runSelectionsRef = React.useRef(runSelectionsSQL);
  runSelectionsRef.current = runSelectionsSQL;

  const runCurrentSQLRef = React.useRef(runCurrentSQL);
  runCurrentSQLRef.current = runCurrentSQL;

  const explainCurrentSQLRef = React.useRef(explainCurrentSQL);
  explainCurrentSQLRef.current = explainCurrentSQL;

  React.useEffect(() => {
    if (!refEditor.current?.element) return;

    const { element } = refEditor.current;

    const keypressCallback = (e: KeyboardEvent) => {
      if (isPrimaryShortcutPressed(e) && e.key.toLowerCase() === 'enter') {
        e.preventDefault();

        if (e.altKey && e.shiftKey) {
          return runAllRef.current();
        }

        if (e.altKey) {
          return runSelectionsRef.current();
        }

        if (e.shiftKey) {
          return runCurrentSQLRef.current(true);
        }

        runCurrentSQLRef.current();
      }

      if (isPrimaryShortcutPressed(e) && e.key.toLocaleLowerCase() === '\\') {
        return runCurrentSQLRef.current(true);
      }

      if (isPrimaryShortcutPressed(e) && e.key.toLowerCase() === 'e') {
        e.preventDefault();
        return explainCurrentSQLRef.current();
      }
    };

    element.addEventListener('keydown', keypressCallback);

    return () => {
      element.removeEventListener('keydown', keypressCallback);
    };
  }, [refEditor.current?.element]);

  React.useEffect(() => {
    loadTableColumns();
  }, [loadTableColumns]);

  React.useEffect(() => {
    const timeout = setTimeout(loadScriptContent);

    return () => clearTimeout(timeout);
  }, [id_script]);

  React.useEffect(() => {
    loadTableReferences();
  }, [loadTableReferences]);

  React.useEffect(() => {
    const removeListener = window.electron.ipcRenderer.on(
      '@event:server_output',
      (_event, message: IServerOutputMessage) => {
        if (message.connectionId !== id_connection || showServerOutputModal) return;

        setHasUnreadServerOutput(true);
      },
    );

    return removeListener;
  }, [id_connection, showServerOutputModal]);

  React.useEffect(() => {
    if (!isActiveTab) return;

    let secondFrameId: number | undefined;

    const firstFrameId = window.requestAnimationFrame(() => {
      refEditor.current?.layout?.();

      secondFrameId = window.requestAnimationFrame(() => {
        refEditor.current?.layout?.();
        refEditor.current?.focus?.();
      });
    });

    return () => {
      window.cancelAnimationFrame(firstFrameId);
      if (secondFrameId) window.cancelAnimationFrame(secondFrameId);
    };
  }, [isActiveTab]);

  return (
    <div className={styles.queryEditorContainer}>
      <div
        className={styles.editorPane}
        style={{ backgroundColor: activeTheme.editor.backgroundColor }}
      >
        <LateralBar
          runAllSQL={runAllSQL}
          runSelectionsSQL={runSelectionsSQL}
          runCurrentSQL={runCurrentSQL}
          explainCurrentSQL={explainCurrentSQL}
          showServerOutput={showServerOutput}
          hasUnreadServerOutput={hasUnreadServerOutput}
        />

        <Editor
          ref={refEditor}
          autoFocus
          dialect={dialect.editorDialect}
          onChange={saveScript}
          onChangeCurrentValue={handleUpdateCurrentQueryInfo}
          onDidChangeContent={clearEditorErrorMarkers}
          autocomplete={autocomplete}
          onCtrlClick={handleEditorCtrlClick}
          contextMenuOptions={editorContextMenuOptions}
        />
      </div>

      <ModalQueryVariables
        show={!!pendingQueryExecution}
        variables={pendingQueryVariables}
        initialValues={queryVariableInitialValues}
        onCancel={closeVariablesModal}
        onExecute={executePendingQuery}
      />

      <ModalQueryVariables
        show={!!pendingExportQuery}
        variables={pendingExportQueryVariables}
        initialValues={queryVariableInitialValues}
        onCancel={closeExportVariablesModal}
        onExecute={exportPendingQuery}
      />

      <ModalExportData
        show={!!exportQuerySource}
        idConnection={id_connection}
        source={exportQuerySource}
        fileName="query-result"
        onClose={closeExportModal}
      />

      <ModalServerOutput
        id_connection={id_connection}
        show={showServerOutputModal}
        onClose={closeServerOutput}
      />

      <ModalConfirmProductionQuery
        dialect={dialect.editorDialect}
        show={!!pendingProductionQueryExecution}
        sql={pendingProductionSql}
        onCancel={closeProductionConfirmModal}
        onConfirm={executePendingProductionQuery}
      />

      {!!tabsResult.length && (
        <ResizableContainer
          direction="vertical"
          height={sizeTabContent}
          minHeight={120}
          maxHeight={800}
          onResize={handleResizeResultTabs}
        >
          <div className={styles.resultTabsContent}>
            <TabBar
              borderTop
              allowClose
              borderBottom
              activeTabId={activeTabId}
              tabs={tabsResult}
              onActiveTab={handleActiveResultTab}
              idTabBar={`bottomTabEditor_${id}`}
              onRemoveTab={handleRemoveResultTab}
              contextMenuOptions={contextMenuOptions}
              ascentColor={activeTheme.queryEditor.tab.ascentColor}
              backgroundColor={activeTheme.queryEditor.tab.backgroundColor}
              backgroundColorBar={activeTheme.queryEditor.tab.bar.backgroundColor}
              color={activeTheme.queryEditor.tab.color}
              borderColor={activeTheme.queryEditor.tab.borderColor}
            />

            <TabWindow activeTabId={activeTabId}>
              {tabsResult.map((tabResult) => {
                const data = querysResultData.get(tabResult.idTab);

                if (!data) return null;

                const isErrorResult = data.type === 'ERROR';
                const isExplainResult = data.type === 'EXPLAIN';
                const isSelectResult =
                  !isErrorResult &&
                  !isExplainResult &&
                  (data.type === 'SELECT' || !!data.columns?.length);
                const isDeleteResult = !isSelectResult && data.type === 'DELETE';
                const isAlterResult = !isSelectResult && data.type === 'ALTER';
                const isGenericResult =
                  !isSelectResult &&
                  !['SELECT', 'DELETE', 'ALTER', 'ERROR', 'EXPLAIN'].includes(data.type);
                const isReadOnlyResult = data.type !== 'SELECT';

                return (
                  <TabContent
                    key={tabResult.idTab}
                    idTab={tabResult.idTab}
                    backgroundColor={activeTheme.queryEditor.tab.backgroundColor}
                  >
                    {isSelectResult && (
                      <TabContentSelect
                        data={data}
                        id_connection={id_connection}
                        references={tableReferences}
                        readOnly={isReadOnlyResult}
                        onSort={(column, sortType) =>
                          handleSortQueryResult(tabResult.idTab, column.attribute, sortType)
                        }
                        onScrollEnd={onScrollEnd}
                        onRefresh={() => refreshResultSqlTab(tabResult.idTab)}
                        onCancelQuery={() => cancelResultQuery(tabResult.idTab)}
                        onToggleCapture={() => toggleResultCapture(tabResult.idTab)}
                        onClearCapture={() => clearResultCapture(tabResult.idTab)}
                        cancelingQuery={
                          !!data.queryExecutionId && cancelingQueryIds.has(data.queryExecutionId)
                        }
                      />
                    )}

                    {isDeleteResult && <TabContentDelete data={data} />}
                    {isAlterResult && <TabContentAlter data={data} />}
                    {isExplainResult && (
                      <TabContentExplain
                        data={data}
                        onCancelQuery={() => cancelResultQuery(tabResult.idTab)}
                        cancelingQuery={
                          !!data.queryExecutionId && cancelingQueryIds.has(data.queryExecutionId)
                        }
                      />
                    )}
                    {isErrorResult && <TabcontentError data={data} />}
                    {isGenericResult && <TabContentGeneric data={data} />}
                  </TabContent>
                );
              })}
            </TabWindow>
          </div>
        </ResizableContainer>
      )}
    </div>
  );
};
