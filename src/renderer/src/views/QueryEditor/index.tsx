import React from 'react';
import Editor, { IEditorRef } from '@renderer/components/Editor';
import styles from './styles.module.css';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import { generateHash } from '@renderer/utils/methods';
import ResizableContainer from '@renderer/components/ResizableContainer';
import useDebounce from '@renderer/hooks/useDebounce';
import useStorage from '@renderer/hooks/useStorage';
import Table from '@renderer/components/Table';
import { ITab } from '@renderer/components/Tabs/components/TabBar';
import {
  ExportIcon,
  IconFileWrited,
  IconRefresh,
  PanelFile,
  RunIcon,
  SaveIcon,
} from '@renderer/styles/icons';
import { RunSelectionIcon } from '../../styles/icons';
import { Input } from '@renderer/components/Input';
import { Button } from '@renderer/components/Button';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { Bar } from '@renderer/components/Bar';

interface IQueryResult {
  idTab: string;
  type: 'select';
  rows?: any[];
  columns?: string[];
  title?: string;
}

interface IDataNewTabResult {
  type: 'select';
  rows?: any[];
  columns?: string[];
  title?: string;
}

export const QueryEditor = () => {
  const refEditor = React.useRef<IEditorRef>();
  const id = React.useMemo(() => generateHash(), []);
  const [activeTabId, setActiveTabId] = React.useState<string>(null);
  const [sizeTabContent, _setSizeTabContent] = useStorage('editor_tab_result_height', 100);
  const setSizeTabContent = useDebounce(_setSizeTabContent);

  const [tabsResult, setTabsResult] = React.useState<ITab[]>([]);
  const [querysResultData, setQuerysResultData] = React.useState<Map<React.Key, IQueryResult>>(
    new Map(),
  );

  const makeNewTabResult = (data: IDataNewTabResult) => {
    const { type, columns = [], rows = [], title = `Result ${tabsResult.length + 1}` } = data;

    const idTab = generateHash();

    const tab: ITab = {
      idTab,
      title,
    };

    const queryResultData: IQueryResult = {
      idTab,
      type,
      columns,
      rows: rows.map((row) => ({ ...row, __hash_rowTable: generateHash() })),
      title,
    };

    setTabsResult((prevState) => [...prevState, tab]);

    setQuerysResultData((prevState) => {
      prevState.set(idTab, queryResultData);
      return new Map(prevState);
    });
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

  const runSelectionsSQL = () => {
    const selectionsValue = getSelectionsValues();
    const value = selectionsValue.join('\n');

    if (!value) return;

    return true;
  };

  const runAllSQL = () => {
    const value = refEditor.current?.getValue?.();

    if (!value) return;

    return true;
  };

  const runSQL = () => {
    const promise = runSelectionsSQL() || runAllSQL();
  };

  React.useEffect(() => {
    if (tabsResult.length) {
      const lastTabIndex = tabsResult.length - 1;
      setActiveTabId(tabsResult[lastTabIndex].idTab);
    }
  }, [tabsResult]);

  // apagar dps
  React.useEffect(() => {
    const columns = ['id', 'name'];
    const rows = [
      { name: 'Fulano 1', id: 1 },
      { name: 'Fulano 2', id: 2 },
      { name: 'Fulano 3', id: 3 },
    ];

    makeNewTabResult({ type: 'select', columns, rows });
    makeNewTabResult({ type: 'select', columns, rows });
    makeNewTabResult({ type: 'select', columns, rows });
  }, []);

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
      <div style={{ flex: 1, display: 'flex' }}>
        <div
          style={{
            height: '100%',
            width: '28px',
            backgroundColor: '#1f1f26',
            borderRight: '2px solid var(--color-border)',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            padding: '22px 0 20px 0',
            gap: '14px',
            justifyContent: 'flex-end',
          }}
        >
          <Button text smallIcon title="Executar script SQL" onClick={runAllSQL}>
            <RunIcon size={16} />
          </Button>

          <Button text smallIcon title="Executar seleção" onClick={runSelectionsSQL}>
            <RunSelectionIcon size={20} />
          </Button>

          <Button text smallIcon title="Mostrar saída do servidor">
            <IconFileWrited size={16} />
          </Button>
        </div>

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
            ascentColor="orange"
            allowClose
            borderBottom
            activeTabId={activeTabId}
            tabs={tabsResult}
            onActiveTab={(tab) => setActiveTabId(tab?.idTab)}
            idTabBar={`bottomTabEditor_${id}`}
            onRemoveTab={(tab) => removeTabResult(tab.idTab)}
          />

          <TabWindow idTabBar={`bottomTabEditor_${id}`}>
            {tabsResult.map((tabResult) => {
              const data = querysResultData.get(tabResult.idTab);

              return (
                <TabContent key={tabResult.idTab} idTab={tabResult.idTab}>
                  {data.type === 'select' && (
                    <>
                      <Table
                        rowKeyExtractor={(item) => item.__hash_rowTable}
                        rows={data.rows}
                        columns={data.columns.map((column) => ({
                          attribute: column,
                          label: column,
                        }))}
                      />

                      <Bar>
                        <Button title="Salvar" text smallIcon>
                          <SaveIcon size={16} />
                        </Button>

                        <Button title="Exportar" text smallIcon>
                          <ExportIcon size={16} />
                        </Button>

                        <Button title="Mostrar dados do vínculo" text smallIcon>
                          <PanelFile size={16} />
                        </Button>

                        <Button title="Atualizar dados" text smallIcon>
                          <IconRefresh size={18} />
                        </Button>

                        <Input
                          title="Offset"
                          centerText
                          defaultValue="200"
                          type="number"
                          maxWidth="80px"
                        />

                        <Spacer />

                        <Text userSelect={false} title="Data da última atualização">
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
