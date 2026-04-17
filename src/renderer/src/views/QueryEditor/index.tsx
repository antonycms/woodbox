import React from 'react';
import Editor, { IEditorRef } from '@renderer/components/Editor';
import styles from './styles.module.css';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import { generateHash } from '@renderer/utils/string';
import ResizableContainer from '@renderer/components/ResizableContainer';
import useDebounce from '@renderer/hooks/useDebounce';
import useStorage from '@renderer/hooks/useStorage';
import { useThemeContext } from '@renderer/contexts/Theme';
import Table from '@renderer/components/Table2';
import { ITab } from '@renderer/components/Tabs/components/TabBar';
import { Button } from '@renderer/components/Button';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { Bar } from '@renderer/components/Bar';
import {
  ExportIcon,
  IconCopyToClipboard,
  IconFileWrited,
  IconRefresh,
  PanelFile,
  RunFileIcon,
  RunIcon,
  SaveIcon,
} from '@renderer/styles/icons';
import { RunSelectionIcon } from '../../styles/icons';
import { IColumnInfo, IColumnReferenceInfo, useStoreContext } from '@renderer/contexts/Store';
import { ITableQuery } from '@renderer/utils/sql';
import useStateWithDebounce from '@renderer/hooks/useStateWithDebounce';
import { getTablesFromQuerySql } from '@renderer/utils/sql';
import { arrayIsEquals, arrayToCSV } from '@renderer/utils/array';
import { IDefineSQlAutocompleteParams } from '@renderer/components/Editor/autocompleteDefault';
import { toDateTime } from '@renderer/utils/date';
import TableInfoWithContext from '@renderer/views/TableInfo';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import useEditorCtrlClickNavigate from '@renderer/hooks/useEditorCtrlClickNavigate';
import { ButtonDropdown } from '@renderer/components/ButtonDropdown';
import { copyToClipboard } from '@renderer/utils/methods';

interface IQueryResult {
  type: string;
  rows?: any[];
  columns?: string[];
  loading?: boolean;
  message?: string;
  query: string;
  affected_rows?: number;
  date_run?: string;
  page?: number;
  auto_paginated?: boolean;
}

type IDataMakeTabResult = IQueryResult & { title?: string };

type IDataUpdateabResult = Partial<IDataMakeTabResult>;

interface IQueryEditorProps {
  id_connection: string;
  id_script?: string;
}

export const QueryEditor = ({ id_connection, id_script }: IQueryEditorProps) => {
  const {
    runSql,
    connectionsInfo,
    getTableColumns,
    getTableReferences,
    editScript,
    getScriptContent,
  } = useStoreContext();

  const { activeTheme } = useThemeContext();
  const { addTab } = useAppTabContext();
  const handleEditorCtrlClick = useEditorCtrlClickNavigate(id_connection);

  const id = React.useMemo(() => generateHash(), []);
  const refEditor = React.useRef<IEditorRef>();
  const [activeTabId, setActiveTabId] = React.useState<string>(null);
  const [sizeTabContent, _setSizeTabContent] = useStorage('editor_tab_result_height', 100);
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

  const queryFkMap = React.useMemo(() => {
    const map = new Map<string, IColumnReferenceInfo>();
    currentQueryTablesInfo.forEach(({ name, schema }) => {
      const key = `${schema ? schema + '.' : ''}${name}`;
      (tableReferences.get(key) || []).forEach((ref) => {
        if (!map.has(ref.column_name)) map.set(ref.column_name, ref);
      });
    });
    return map;
  }, [currentQueryTablesInfo, tableReferences]);

  const makeUpdateResultTab = (idTab: string) => {
    const updateTabResultData = (params: IDataUpdateabResult) => {
      setQuerysResultData((prevState) => {
        const newMap = new Map(prevState);

        const prevTabResultData = prevState.get(idTab) || ({} as any);
        const newTabResultData = { ...prevTabResultData, ...params };

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
    };

    setTabsResult((prevState) => [...prevState, tab]);

    const updateTabResultData = makeUpdateResultTab(idTab);

    updateTabResultData(queryResultData);

    return updateTabResultData;
  };

  const removeTabResult = (idTab: string) => {
    setTabsResult((prevState) => prevState.filter((tab) => tab.idTab !== idTab));

    setQuerysResultData((prevState) => {
      prevState.delete(idTab);
      return new Map(prevState);
    });

    if (activeTabId === idTab) setActiveTabId(null);
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

  const refreshResultSqlTab = async (idTab: string) => {
    const tab = querysResultData.get(idTab);
    const updateTabResultData = makeUpdateResultTab(idTab);

    updateTabResultData({ loading: true, date_run: new Date().toISOString() });

    try {
      const [{ type, rows, columns, affected_rows, auto_paginated }] = await runSql(
        id_connection,
        tab.query,
      );

      updateTabResultData({
        columns,
        rows,
        type,
        query: tab.query,
        affected_rows,
        auto_paginated,
        loading: false,
      });
    } catch (error) {
      const message = `${error?.message} (position: ${error.position})`;
      updateTabResultData({ type: 'ERROR', message, query: tab.query, loading: false });
    }
  };

  const runCurrentSQL = async (openNewTab?: boolean) => {
    const query = getSelectionsValues().join('\n') || refEditor.current?.getCurrentValue?.();

    if (!query) return;

    const updateTabResultData =
      !openNewTab && activeTabId
        ? makeUpdateResultTab(activeTabId)
        : makeNewTabResult({ query, type: 'SELECT', date_run: new Date().toISOString() });

    updateTabResultData({ loading: true });

    try {
      const [{ type, rows, columns, affected_rows, auto_paginated }] = await runSql(
        id_connection,
        query,
      );

      updateTabResultData({
        page: 1,
        query,
        columns,
        rows,
        type,
        affected_rows,
        auto_paginated,
        loading: false,
      });
    } catch (error) {
      const message = `${error?.message} (position: ${error.position})`;
      updateTabResultData({ type: 'ERROR', query, message, loading: false });
    }
  };

  const runSelectionsSQL = async () => {
    const selectionsValue = getSelectionsValues();
    const query = selectionsValue.join('\n');

    if (!query) return;

    const updateTabResultData = makeNewTabResult({
      type: 'SELECT',
      query,
      loading: true,
      date_run: new Date().toISOString(),
    });

    try {
      const [{ type, rows, columns, affected_rows, auto_paginated }] = await runSql(
        id_connection,
        query,
      );

      updateTabResultData({
        page: 1,
        columns,
        rows,
        type,
        affected_rows,
        auto_paginated,
        loading: false,
      });
    } catch (error) {
      const message = `${error?.message} (position: ${error.position})`;
      updateTabResultData({ type: 'ERROR', message, loading: false });
    }
  };

  const runAllSQL = async () => {
    const query = refEditor.current?.getValue?.();

    if (!query) return;

    const updateTabResultData = makeNewTabResult({
      type: 'SELECT',
      loading: true,
      query,
      date_run: new Date().toISOString(),
    });

    try {
      refEditor.current.setMarkers([]);

      const x = await runSql(id_connection, query);

      const [{ type, rows, columns, affected_rows, auto_paginated }] = x;

      updateTabResultData({
        page: 1,
        columns,
        rows,
        type,
        affected_rows,
        auto_paginated,
        loading: false,
      });
    } catch (error) {
      const message = error?.message?.split?.(' - ')?.[1];

      updateTabResultData({ type: 'ERROR', message, loading: false });

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

  const onScrollEnd = async () => {
    const lastTabResult = querysResultData.get(activeTabId);

    if (!lastTabResult || !lastTabResult.auto_paginated) return;

    const updateTabResultData = makeUpdateResultTab(activeTabId);

    const query = lastTabResult.query;
    const newPage = (lastTabResult.page || 1) + 1;

    updateTabResultData({ loading: true });

    try {
      const [{ type, rows, columns, affected_rows, auto_paginated }] = await runSql(
        id_connection,
        query,
        { page: newPage },
      );

      updateTabResultData({
        page: newPage,
        columns,
        rows: [...lastTabResult.rows, ...rows],
        type,
        query,
        affected_rows,
        auto_paginated,
        loading: false,
      });
    } catch (error) {
      const message = `${error?.message} (position: ${error.position})`;
      updateTabResultData({ type: 'ERROR', query, message, loading: false });
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

  const handleFkCellClick = React.useCallback(
    (attribute: string, value: any) => {
      const ref = queryFkMap.get(attribute);
      if (!ref || value === null || value === undefined) return;
      const tabTitle = `${ref.reference_table_name} [${ref.reference_column_name}=${value}]`;
      const escapedValue = String(value).replace(/'/g, "''");
      const initialWhere = `"${ref.reference_column_name}" = '${escapedValue}'`;
      addTab({
        title: tabTitle,
        component: () => (
          <TableInfoWithContext
            id_connection={id_connection}
            schema={ref.reference_table_schema}
            table={ref.reference_table_name}
            initialWhere={initialWhere}
            filterLocked
            initialTab="tabData"
          />
        ),
      });
    },
    [queryFkMap, id_connection, addTab],
  );

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

    if (id_script) saveScript();
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
        <Bar
          vertical
          backgroundColor={activeTheme.queryEditor.bar.backgroundColor}
          borderColor={activeTheme.queryEditor.bar.borderColor}
        >
          <Button
            text
            smallIcon
            title="Executar script SQL (Ctrl + Shift + Alt + Enter)"
            onClick={runAllSQL}
            color={activeTheme.queryEditor.bar.color}
          >
            <RunFileIcon size={16} />
          </Button>

          <Button
            text
            smallIcon
            title="Executar SQL selecionado (Ctrl + Alt + Enter)"
            onClick={runSelectionsSQL}
            color={activeTheme.queryEditor.bar.color}
          >
            <RunSelectionIcon size={20} />
          </Button>

          <Button
            text
            smallIcon
            title="Executar SQL atual (Ctrl + Shift + Enter)"
            onClick={() => runCurrentSQL(true)}
            color={activeTheme.queryEditor.bar.color}
          >
            <RunIcon size={16} />
          </Button>

          <Button
            text
            smallIcon
            title="Mostrar saída do servidor"
            color={activeTheme.queryEditor.bar.color}
          >
            <IconFileWrited size={16} />
          </Button>
        </Bar>

        <Editor
          ref={refEditor}
          dialect="postgres"
          onChangeCurrentValue={handleUpdateCurrentQueryInfo}
          autocomplete={autocomplete}
          onCtrlClick={handleEditorCtrlClick}
        />
      </div>

      {!!tabsResult.length && (
        <ResizableContainer
          direction="vertical"
          height={sizeTabContent}
          minHeight={140}
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
                    <>
                      <Table
                        loading={!!data.loading}
                        rows={data.rows}
                        onScrollEnd={onScrollEnd}
                        onCellLinkClick={handleFkCellClick}
                        columns={data.columns.map((column) => ({
                          attribute: column,
                          label: column,
                          isFk: queryFkMap.has(column),
                        }))}
                      />

                      <Bar
                        backgroundColor={activeTheme.queryEditor.bar.backgroundColor}
                        borderColor={activeTheme.queryEditor.bar.borderColor}
                      >
                        <Button
                          text
                          smallIcon
                          title="Salvar"
                          color={activeTheme.queryEditor.bar.color}
                        >
                          <SaveIcon size={16} />
                        </Button>

                        <ButtonDropdown
                          text
                          smallIcon
                          title="Copiar para área de transferencia"
                          direction="up"
                          dropdownBackground={activeTheme.queryEditor.bar.backgroundColor}
                          dropdownColor={activeTheme.queryEditor.bar.color}
                          color={activeTheme.queryEditor.bar.color}
                          onSelect={(opt) => {
                            if (opt.id === 'JSON') {
                              copyToClipboard(JSON.stringify(data.rows, null, 2));
                            }
                            if (opt.id === 'CSV') {
                              copyToClipboard(arrayToCSV(data.rows));
                            }
                          }}
                          options={[
                            { id: 'JSON', label: 'JSON' },
                            { id: 'CSV', label: 'CSV' },
                          ]}
                        >
                          <IconCopyToClipboard size={16} />
                        </ButtonDropdown>

                        <Button
                          text
                          smallIcon
                          title="Exportar"
                          color={activeTheme.queryEditor.bar.color}
                        >
                          <ExportIcon size={16} />
                        </Button>

                        <Button
                          text
                          smallIcon
                          title="Mostrar dados do vínculo"
                          color={activeTheme.queryEditor.bar.color}
                        >
                          <PanelFile size={16} />
                        </Button>

                        <Button
                          text
                          smallIcon
                          title="Atualizar dados"
                          onClick={() => refreshResultSqlTab(tabResult.idTab)}
                          color={activeTheme.queryEditor.bar.color}
                        >
                          <IconRefresh size={18} />
                        </Button>

                        <Spacer />

                        <Text
                          title="Data da última atualização"
                          userSelect={false}
                          color={activeTheme.queryEditor.bar.color}
                        >
                          Atualizado em {toDateTime(data.date_run)}
                        </Text>
                      </Bar>
                    </>
                  )}

                  {data.type === 'DELETE' && (
                    <div className={styles.paddingContent}>
                      <Text bold color={activeTheme.queryEditor.tab.color}>
                        Remoção executada com sucesso
                      </Text>

                      <Text color={activeTheme.queryEditor.tab.color}>{data.query}</Text>
                      <Text color={activeTheme.queryEditor.tab.color}>
                        Total de linhas afetadas: {data.affected_rows}
                      </Text>

                      <Text color={activeTheme.queryEditor.tab.color}>
                        Executado em {toDateTime(data.date_run)}
                      </Text>
                    </div>
                  )}

                  {data.type === 'ALTER' && (
                    <div className={styles.paddingContent}>
                      <Text bold color={activeTheme.queryEditor.tab.color}>
                        Alteração realizada com sucesso
                      </Text>

                      <Text color={activeTheme.queryEditor.tab.color}>{data.query}</Text>

                      <Text color={activeTheme.queryEditor.tab.color}>
                        Executado em {toDateTime(data.date_run)}
                      </Text>
                    </div>
                  )}

                  {data.type === 'ERROR' && (
                    <div className={styles.paddingContent}>
                      <Text bold color={activeTheme.queryEditor.tab.color}>
                        Erro ao executar a query
                      </Text>

                      <Text color={activeTheme.queryEditor.tab.color}>{data.message}</Text>

                      <Text color={activeTheme.queryEditor.tab.color}>
                        Executado em {toDateTime(data.date_run)}
                      </Text>
                    </div>
                  )}

                  {!['SELECT', 'DELETE', 'ALTER', 'ERROR'].includes(data.type) && (
                    <div className={styles.paddingContent}>
                      <Text bold color={activeTheme.queryEditor.tab.color}>
                        Query executada com sucesso
                      </Text>

                      <Text color={activeTheme.queryEditor.tab.color}>{data.query}</Text>

                      <Text color={activeTheme.queryEditor.tab.color}>
                        Executado em {toDateTime(data.date_run)}
                      </Text>
                    </div>
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
