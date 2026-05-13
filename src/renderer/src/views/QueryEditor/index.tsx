import React from 'react';
import Editor, { IEditorRef } from '@renderer/components/Editor';
import styles from './styles.module.css';
import {
  TabBar,
  TabContent,
  TabWindow,
  type IActiveTabContextMenu,
} from '@renderer/components/Tabs';
import type { IContextMenuOption } from '@renderer/components/ContextMenu';
import { generateHash } from '@renderer/utils/string';
import ResizableContainer from '@renderer/components/ResizableContainer';
import useDebounce from '@renderer/hooks/useDebounce';
import useStorage from '@renderer/hooks/useStorage';
import { useThemeContext } from '@renderer/contexts/Theme';
import { ITab } from '@renderer/components/Tabs/components/TabBar';
import { IColumnInfo, IColumnReferenceInfo, useStoreContext } from '@renderer/contexts/Store';
import useStateWithDebounce from '@renderer/hooks/useStateWithDebounce';
import { getTablesFromQuerySql, hasUnsafeSqlMutation, ITableQuery } from '@renderer/utils/sql';
import { getNextSort } from '@renderer/utils/tableSort';
import { arrayIsEquals } from '@renderer/utils/array';
import { IDefineSQlAutocompleteParams } from '@renderer/components/Editor/autocompleteDefault';
import useEditorCtrlClickNavigate from '@renderer/hooks/useEditorCtrlClickNavigate';
import { ModalQueryVariables } from './components/ModalQueryVariables';
import { ModalConfirmProductionQuery } from './components/ModalConfirmProductionQuery';
import { getQueryVariables, prepareQueryVariables } from './utils/queryVariables';
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

export const QueryEditor = ({ id_connection, id_script }: IQueryEditorProps) => {
  const {
    runSql,
    connections,
    connectionsInfo,
    getTableColumns,
    getTableReferences,
    editScript,
    getScriptContent,
  } = useStoreContext();

  const { activeTheme } = useThemeContext();
  const handleEditorCtrlClick = useEditorCtrlClickNavigate(id_connection);
  const currentConnection = React.useMemo(
    () => connections.find((connection) => connection.id === id_connection),
    [connections, id_connection],
  );
  const isProductionConnection = currentConnection?.environment === 'production';

  const id = React.useMemo(() => generateHash(), []);
  const refEditor = React.useRef<IEditorRef>(null);
  const [activeTabId, setActiveTabId] = React.useState<string>(null);
  const [sizeTabContent, _setSizeTabContent] = useStorage('editor_tab_result_height', 240);
  const setSizeTabContent = useDebounce(_setSizeTabContent);

  const [currentQueryTablesInfo, setCurrentQueryTablesInfo] = useStateWithDebounce<ITableQuery[]>(
    [],
    500,
  );
  const [tableColumns, setTableColumn] = React.useState<Map<string, IColumnInfo[]>>(new Map());
  const [tableReferences, setTableReferences] = React.useState<Map<string, IColumnReferenceInfo[]>>(
    new Map(),
  );
  const [tabsResult, setTabsResult] = React.useState<ITab[]>([]);
  const [querysResultData, setQuerysResultData] = React.useState<Map<React.Key, IQueryResult>>(
    new Map(),
  );
  const [pendingQueryExecution, setPendingQueryExecution] =
    React.useState<IPendingQueryExecution>();
  const [pendingProductionQueryExecution, setPendingProductionQueryExecution] =
    React.useState<IExecuteQueryParams>();

  const makeUpdateResultTab = (idTab: string) => {
    const updateTabResultData = (params: IDataUpdateabResult) => {
      setQuerysResultData((prevState) => {
        const newMap = new Map(prevState);

        const prevTabResultData = prevState.get(idTab) || ({} as IQueryResult);
        const newTabResultData = { ...prevTabResultData, ...params };

        newTabResultData.tables_info = getTablesFromQuerySql(newTabResultData.query);

        newMap.set(idTab, newTabResultData);

        return newMap;
      });
    };

    return updateTabResultData;
  };

  const makeNewTabResult = (data: IDataMakeTabResult) => {
    const {
      loading,
      type,
      columns = [],
      rows = [],
      query,
      affected_rows,
      page,
      title = `Result ${tabsResult.length + 1}`,
      variableValues,
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
      tables_info: getTablesFromQuerySql(query),
      variableValues,
    };

    setTabsResult((prevState) => [...prevState, tab]);

    const updateTabResultData = makeUpdateResultTab(idTab);

    updateTabResultData(queryResultData);

    return updateTabResultData;
  };

  const removeTabResult = (idTab: string | string[]) => {
    const tabsIdToRemove = new Set(Array.isArray(idTab) ? idTab : [idTab]);

    setTabsResult((prevState) => prevState.filter((tab) => !tabsIdToRemove.has(tab.idTab)));

    setQuerysResultData((prevState) => {
      const newMap = new Map(prevState);

      tabsIdToRemove.forEach((id) => newMap.delete(id));

      return newMap;
    });

    if (activeTabId && tabsIdToRemove.has(activeTabId)) setActiveTabId(null);
  };

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

    const updateTabResultData =
      !forceNewTab && !openNewTab && activeTabId
        ? makeUpdateResultTab(activeTabId)
        : makeNewTabResult({
            query,
            variableValues,
            type: 'SELECT',
            date_run: new Date().toISOString(),
          });

    updateTabResultData({ loading: true, date_run: new Date().toISOString() });

    try {
      if (markErrors) refEditor.current.setMarkers([]);

      const [{ type, rows, columns, affected_rows, auto_paginated, execution_time_ms }] =
        await runSql(id_connection, preparedQuery);

      updateTabResultData({
        page: 1,
        query,
        variableValues,
        columns,
        rows,
        type,
        affected_rows,
        auto_paginated,
        execution_time_ms,
        loading: false,
      });
    } catch (error) {
      const message = markErrors
        ? error?.message?.split?.(' - ')?.[1] || error?.message
        : `${error?.message} (position: ${error.position})`;

      updateTabResultData({ type: 'ERROR', query, variableValues, message, loading: false });

      if (!markErrors) return;

      const position = Number(error.position) + 1;

      let startLine = 1;
      let endLine = 1;
      let startColumn = 1;
      let endColumn = 1;

      let currentLine = 1;
      let currentColumn = 1;

      for (let i = 1; i <= query.length; i++) {
        currentColumn++;

        const word = query[i];

        if (word === '\n') {
          currentLine++;
          currentColumn = 1;
        }

        if (i === position) {
          startLine = currentLine;
          startColumn = currentColumn;
        }

        if (i === query.length) {
          endLine = currentLine;
          endColumn = currentColumn;
        }
      }

      refEditor.current.setMarkers([
        {
          message,
          startLineNumber: startLine,
          endLineNumber: endLine,
          code: `SQL Error`,
          startColumn,
          endColumn,
          severity: 'Error',
        },
      ]);
    }
  };

  const confirmOrExecuteQuery = (params: IExecuteQueryParams) => {
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

  const closeVariablesModal = () => setPendingQueryExecution(undefined);
  const closeProductionConfirmModal = () => setPendingProductionQueryExecution(undefined);

  const executePendingQuery = (variableValues: Record<string, string>) => {
    if (!pendingQueryExecution) return;

    const params = { ...pendingQueryExecution, variableValues };
    setPendingQueryExecution(undefined);
    confirmOrExecuteQuery(params);
  };

  const executePendingProductionQuery = () => {
    if (!pendingProductionQueryExecution) return;

    const params = pendingProductionQueryExecution;
    setPendingProductionQueryExecution(undefined);
    executeQuery(params);
  };

  const refreshResultSqlTab = async (idTab: string) => {
    const tab = querysResultData.get(idTab);
    const updateTabResultData = makeUpdateResultTab(idTab);
    const preparedQuery = prepareQueryVariables(tab.query, tab.variableValues);

    updateTabResultData({ loading: true, date_run: new Date().toISOString() });

    try {
      const [{ type, rows, columns, affected_rows, auto_paginated, execution_time_ms }] =
        await runSql(id_connection, preparedQuery, {
          orderBy: tab.orderBy,
        });

      updateTabResultData({
        page: 1,
        columns,
        rows,
        type,
        query: tab.query,
        variableValues: tab.variableValues,
        affected_rows,
        auto_paginated,
        execution_time_ms,
        loading: false,
        orderBy: tab.orderBy,
      });
    } catch (error) {
      const message = `${error?.message} (position: ${error.position})`;
      updateTabResultData({
        type: 'ERROR',
        message,
        query: tab.query,
        variableValues: tab.variableValues,
        loading: false,
      });
    }
  };

  const runCurrentSQL = async (openNewTab?: boolean) => {
    const query = getSelectionsValues().join('\n') || refEditor.current?.getCurrentValue?.();

    if (!query) return;

    requestQueryExecution({ query, openNewTab });
  };

  const runSelectionsSQL = async () => {
    const selectionsValue = getSelectionsValues();
    const query = selectionsValue.join('\n');

    if (!query) return;

    requestQueryExecution({ query, forceNewTab: true });
  };

  const runAllSQL = async () => {
    const query = refEditor.current?.getValue?.();

    if (!query) return;

    requestQueryExecution({ query, forceNewTab: true, markErrors: true });
  };

  const onScrollEnd = async () => {
    const lastTabResult = querysResultData.get(activeTabId);

    if (!lastTabResult || lastTabResult.loading || !lastTabResult.auto_paginated) return;

    const updateTabResultData = makeUpdateResultTab(activeTabId);

    const query = lastTabResult.query;
    const preparedQuery = prepareQueryVariables(query, lastTabResult.variableValues);
    const newPage = (lastTabResult.page || 1) + 1;

    updateTabResultData({ loading: true });

    try {
      const [{ type, rows, columns, affected_rows, auto_paginated, execution_time_ms }] =
        await runSql(id_connection, preparedQuery, {
          page: newPage,
          orderBy: lastTabResult.orderBy,
        });

      updateTabResultData({
        page: newPage,
        columns,
        rows: [...lastTabResult.rows, ...rows],
        type,
        query,
        variableValues: lastTabResult.variableValues,
        affected_rows,
        auto_paginated,
        loading: false,
        execution_time_ms,
      });
    } catch (error) {
      const message = `${error?.message} (position: ${error.position})`;
      updateTabResultData({
        type: 'ERROR',
        query,
        variableValues: lastTabResult.variableValues,
        message,
        loading: false,
      });
    }
  };

  const handleSortQueryResult = async (idTab: string, columnName: string) => {
    const tab = querysResultData.get(idTab);
    if (!tab || tab.loading) return;

    const orderBy = getNextSort(tab.orderBy, columnName);
    const updateTabResultData = makeUpdateResultTab(idTab);
    const preparedQuery = prepareQueryVariables(tab.query, tab.variableValues);

    updateTabResultData({ loading: true, orderBy });

    try {
      const [{ type, rows, columns, affected_rows, auto_paginated, execution_time_ms }] =
        await runSql(id_connection, preparedQuery, {
          page: 1,
          orderBy,
        });

      updateTabResultData({
        page: 1,
        columns,
        rows,
        type,
        query: tab.query,
        variableValues: tab.variableValues,
        affected_rows,
        auto_paginated,
        execution_time_ms,
        loading: false,
        orderBy,
      });
    } catch (error) {
      const message = `${error?.message} (position: ${error.position})`;
      updateTabResultData({ type: 'ERROR', message, loading: false });
    }
  };

  const loadTableColumns = async () => {
    const newTable = currentQueryTablesInfo.find((tableInfo) => {
      const { name, schema } = tableInfo;
      const key = `${schema ? schema + '.' : ''}${name}`;
      return !tableColumns.get(key);
    });

    if (!newTable) return;

    const { name: table, schema } = newTable;

    const items = await getTableColumns(id_connection, { schema, table });

    if (!items?.length) return;

    setTableColumn((prevState) => {
      const newState = new Map(prevState);
      const key = `${schema ? schema + '.' : ''}${table}`;
      newState.set(key, items);
      return newState;
    });
  };

  const loadTableReferences = async () => {
    const newTable = currentQueryTablesInfo.find((tableInfo) => {
      const { name, schema } = tableInfo;
      const key = `${schema ? schema + '.' : ''}${name}`;
      return !tableReferences.get(key);
    });

    if (!newTable) return;

    const { name: table, schema } = newTable;
    const items = await getTableReferences(id_connection, { schema, table });

    setTableReferences((prevState) => {
      const newState = new Map(prevState);
      const key = `${schema ? schema + '.' : ''}${table}`;
      newState.set(key, items || []);
      return newState;
    });
  };

  const loadScriptContent = async () => {
    if (!id_script) return;

    const content = await getScriptContent(id_script);

    if (content) refEditor.current.setValue(content);
  };

  const saveScript = useDebounce(() => {
    if (!id_script) return;

    const content = refEditor.current?.getValue();

    editScript(id_script, { content, updated_at: new Date().toISOString() });
  }, 1000);

  const handleUpdateCurrentQueryInfo = React.useCallback((query: string) => {
    const tablesQueryInfo = getTablesFromQuerySql(query);

    setCurrentQueryTablesInfo((prevState) => {
      // avoid changing the state memory address if there are no changes (prevent rerendering)
      const checkIsEquals = arrayIsEquals(prevState, tablesQueryInfo);
      return checkIsEquals ? prevState : tablesQueryInfo;
    });
  }, []);

  const autocomplete = React.useMemo<IDefineSQlAutocompleteParams>(() => {
    const connectionInfo = connectionsInfo.get(id_connection);

    if (!connectionInfo) return;

    const { schemas, tables } = connectionInfo;

    const schemasSerialized = schemas.map((schema) => ({ name: schema }));
    const tablesAvailable = tables.map((table) => ({
      name: table.table_name,
      schema: table.table_schema,
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

    return { schemas: schemasSerialized, tablesAvailable, tablesUsed, columns };
  }, [connectionsInfo, currentQueryTablesInfo, tableColumns]);

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
    [tabsResult, activeTabId],
  );

  const runAllRef = React.useRef(runAllSQL);
  runAllRef.current = runAllSQL;

  const runSelectionsRef = React.useRef(runSelectionsSQL);
  runSelectionsRef.current = runSelectionsSQL;

  const runCurrentSQLRef = React.useRef(runCurrentSQL);
  runCurrentSQLRef.current = runCurrentSQL;

  React.useEffect(() => {
    if (!refEditor.current?.element) return;

    const { element } = refEditor.current;

    const keypressCallback = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'enter') {
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

      if (e.ctrlKey && e.key.toLocaleLowerCase() === '\\') {
        return runCurrentSQLRef.current(true);
      }
    };

    element.addEventListener('keydown', keypressCallback);

    return () => {
      element.removeEventListener('keydown', keypressCallback);
    };
  }, [refEditor.current?.element]);

  React.useEffect(() => {
    loadTableColumns();
  }, [id_connection, currentQueryTablesInfo]);

  React.useEffect(() => {
    const timeout = setTimeout(loadScriptContent);

    return () => clearTimeout(timeout);
  }, [id_script]);

  React.useEffect(() => {
    if (tabsResult.length) {
      const lastTabIndex = tabsResult.length - 1;
      setActiveTabId(tabsResult[lastTabIndex].idTab);
    }
  }, [tabsResult]);

  React.useEffect(() => {
    loadTableReferences();
  }, [id_connection, currentQueryTablesInfo]);

  return (
    <div className={styles.queryEditorContainer}>
      <div
        style={{ flex: 1, display: 'flex', backgroundColor: activeTheme.editor.backgroundColor }}
      >
        <LateralBar
          runAllSQL={runAllSQL}
          runSelectionsSQL={runSelectionsSQL}
          runCurrentSQL={runCurrentSQL}
        />

        <Editor
          ref={refEditor}
          dialect="postgres"
          onChange={saveScript}
          onChangeCurrentValue={handleUpdateCurrentQueryInfo}
          autocomplete={autocomplete}
          onCtrlClick={handleEditorCtrlClick}
        />
      </div>

      <ModalQueryVariables
        show={!!pendingQueryExecution}
        variables={getQueryVariables(pendingQueryExecution?.query || '')}
        onCancel={closeVariablesModal}
        onExecute={executePendingQuery}
      />

      <ModalConfirmProductionQuery
        show={!!pendingProductionQueryExecution}
        sql={
          pendingProductionQueryExecution
            ? prepareQueryVariables(
                pendingProductionQueryExecution.query,
                pendingProductionQueryExecution.variableValues,
              )
            : ''
        }
        onCancel={closeProductionConfirmModal}
        onConfirm={executePendingProductionQuery}
      />

      {!!tabsResult.length && (
        <ResizableContainer
          direction="vertical"
          height={sizeTabContent}
          minHeight={120}
          maxHeight={800}
          onResize={(size) => setSizeTabContent(size.height)}
        >
          <TabBar
            borderTop
            allowClose
            borderBottom
            activeTabId={activeTabId}
            tabs={tabsResult}
            onActiveTab={(tab) => setActiveTabId(tab?.idTab)}
            idTabBar={`bottomTabEditor_${id}`}
            onRemoveTab={(tab) => removeTabResult(tab.idTab)}
            contextMenuOptions={contextMenuOptions}
            ascentColor={activeTheme.queryEditor.tab.ascentColor}
            backgroundColor={activeTheme.queryEditor.tab.backgroundColor}
            backgroundColorBar={activeTheme.queryEditor.tab.bar.backgroundColor}
            color={activeTheme.queryEditor.tab.color}
            borderColor={activeTheme.queryEditor.tab.borderColor}
          />

          <TabWindow idTabBar={`bottomTabEditor_${id}`}>
            {tabsResult.map((tabResult) => {
              const data = querysResultData.get(tabResult.idTab);

              if (!data) return null;

              return (
                <TabContent
                  key={tabResult.idTab}
                  idTab={tabResult.idTab}
                  backgroundColor={activeTheme.queryEditor.tab.backgroundColor}
                >
                  {data.type === 'SELECT' && (
                    <TabContentSelect
                      data={data}
                      id_connection={id_connection}
                      references={tableReferences}
                      onSort={(column) => handleSortQueryResult(tabResult.idTab, column.attribute)}
                      onScrollEnd={onScrollEnd}
                      onRefresh={() => refreshResultSqlTab(tabResult.idTab)}
                    />
                  )}

                  {data.type === 'DELETE' && <TabContentDelete data={data} />}

                  {data.type === 'ALTER' && <TabContentAlter data={data} />}

                  {data.type === 'ERROR' && <TabcontentError data={data} />}

                  {!['SELECT', 'DELETE', 'ALTER', 'ERROR'].includes(data.type) && (
                    <TabContentGeneric data={data} />
                  )}
                </TabContent>
              );
            })}
          </TabWindow>
        </ResizableContainer>
      )}
    </div>
  );
};
