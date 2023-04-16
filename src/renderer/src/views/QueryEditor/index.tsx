import React from 'react';
import Editor, { IEditorRef } from '@renderer/components/Editor';
import styles from './styles.module.css';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import { generateHash } from '@renderer/utils/methods';
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
  IconFileWrited,
  IconRefresh,
  PanelFile,
  RunIcon,
  SaveIcon,
} from '@renderer/styles/icons';
import { RunSelectionIcon } from '../../styles/icons';
import { useStoreContext } from '@renderer/contexts/Store';

interface IQueryResult {
  type?: string;
  rows?: any[];
  columns?: string[];
  title?: string;
  loading?: boolean;
}

type IDataUpdateabResult = Partial<IQueryResult>;

interface IQueryEditorProps {
  id_connection: string;
}

export const QueryEditor = ({ id_connection }: IQueryEditorProps) => {
  const { runSql, connectionsInfo } = useStoreContext();
  const { activeTheme } = useThemeContext();

  const id = React.useMemo(() => generateHash(), []);
  const refEditor = React.useRef<IEditorRef>();
  const [connectionInfo, setConnectionInfo] = React.useState(connectionsInfo.get(id_connection));
  const [activeTabId, setActiveTabId] = React.useState<string>(null);
  const [sizeTabContent, _setSizeTabContent] = useStorage('editor_tab_result_height', 100);
  const setSizeTabContent = useDebounce(_setSizeTabContent);

  const [tabsResult, setTabsResult] = React.useState<ITab[]>([]);
  const [querysResultData, setQuerysResultData] = React.useState<Map<React.Key, IQueryResult>>(
    new Map(),
  );

  const makeNewTabResult = (data: IQueryResult) => {
    const {
      loading,
      type,
      columns = [],
      rows = [],
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
      title,
      loading,
    };

    setTabsResult((prevState) => [...prevState, tab]);

    const updateTabResultData = (params: IDataUpdateabResult) => {
      setQuerysResultData((prevState) => {
        const newMap = new Map(prevState);

        const prevTabResultData = prevState.get(idTab) || {};
        const newTabResultData = { type, ...prevTabResultData, ...params };

        newTabResultData.rows = newTabResultData.rows?.map?.((row) => ({
          ...row,
          __hash_rowTable: generateHash(),
        }));

        newMap.set(idTab, newTabResultData);

        return newMap;
      });
    };

    updateTabResultData(queryResultData);

    return updateTabResultData;
  };

  const removeTabResult = (idTab: string) => {
    setTabsResult((prevState) => prevState.filter((tab) => tab.idTab !== idTab));

    setQuerysResultData((prevState) => {
      prevState.delete(idTab);
      return new Map(prevState);
    });
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

  const runSelectionsSQL = async () => {
    const selectionsValue = getSelectionsValues();
    const value = selectionsValue.join('\n');

    if (!value) return;

    const updateTabResultData = makeNewTabResult({
      columns: [],
      rows: [],
      type: 'SELECT',
      loading: true,
    });

    const { type, rows, columns } = await runSql(id_connection, value);

    updateTabResultData({ columns, rows, type, loading: false });
  };

  const runAllSQL = async () => {
    const value = refEditor.current?.getValue?.();

    if (!value) return;

    const updateTabResultData = makeNewTabResult({
      columns: [],
      rows: [],
      type: 'SELECT',
      loading: true,
    });

    const { type, rows, columns } = await runSql(id_connection, value);
    console.log(rows);

    updateTabResultData({ columns, rows, type, loading: false });
  };

  React.useEffect(() => {
    if (tabsResult.length) {
      const lastTabIndex = tabsResult.length - 1;
      setActiveTabId(tabsResult[lastTabIndex].idTab);
    }
  }, [tabsResult]);

  // // apagar dps
  // React.useEffect(() => {
  //   const columns = ['id', 'name'];
  //   const rows = [
  //     { name: 'Fulano 1', id: 1 },
  //     { name: 'Fulano 2', id: 2 },
  //     { name: 'Fulano 3', id: 3 },
  //   ];

  //   makeNewTabResult({ type: 'select', columns, rows });
  //   makeNewTabResult({ type: 'select', columns, rows });
  //   makeNewTabResult({ type: 'select', columns, rows });
  // }, []);

  React.useEffect(() => {
    if (!refEditor.current?.element) return;

    const { element } = refEditor.current;

    const keypressCallback = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key.toLowerCase() === 'enter') {
        e.preventDefault();

        if (e.altKey) {
          console.log(1);
          return;
        }

        console.log(2);
      }
    };

    element.addEventListener('keydown', keypressCallback);

    return () => {
      element.removeEventListener('keydown', keypressCallback);
    };
  }, [refEditor.current?.element]);

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
            title="Executar script SQL"
            onClick={runAllSQL}
            color={activeTheme.queryEditor.bar.color}
          >
            <RunIcon size={16} />
          </Button>

          <Button
            text
            smallIcon
            title="Executar seleção"
            onClick={runSelectionsSQL}
            color={activeTheme.queryEditor.bar.color}
          >
            <RunSelectionIcon size={20} />
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

        <Editor ref={refEditor} dialect="postgres" />
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
                <TabContent key={tabResult.idTab} idTab={tabResult.idTab}>
                  {data.type === 'SELECT' && (
                    <>
                      <Table
                        loading={!!data.loading}
                        rowKeyExtractor={(item) => item.__hash_rowTable}
                        rows={data.rows}
                        columns={data.columns.map((column) => ({
                          attribute: column,
                          label: column,
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
                          Atualizado em 25 de set. as 09:18
                        </Text>
                      </Bar>
                    </>
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
