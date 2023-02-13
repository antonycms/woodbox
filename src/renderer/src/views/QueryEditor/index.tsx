import React from 'react';
import Editor, { IEditorRef } from '@renderer/components/Editor';
import styles from './styles.module.css';
import { TabBar, TabContent, TabWindow } from '@renderer/components/Tabs';
import { generateHash } from '@renderer/utils/methods';
import ResizableContainer from '@renderer/components/ResizableContainer';
import useDebounce from '@renderer/hooks/useDebounce';
import useStorage from '@renderer/hooks/useStorage';
import { useThemeContext } from '@renderer/contexts/Theme';
import Table from '@renderer/components/Table';
import { ITab } from '@renderer/components/Tabs/components/TabBar';
import { Input } from '@renderer/components/Input';
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
  const { activeTheme } = useThemeContext();

  const id = React.useMemo(() => generateHash(), []);
  const refEditor = React.useRef<IEditorRef>();
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
      <div style={{ flex: 1, display: 'flex', backgroundColor: activeTheme.editor.backgroundColor }}>
        <Bar vertical backgroundColor={activeTheme.queryEditor.bar.backgroundColor}>
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

                      <Bar backgroundColor={activeTheme.queryEditor.bar.backgroundColor}>
                        <Button text smallIcon title="Salvar" color={activeTheme.queryEditor.bar.color}>
                          <SaveIcon size={16} />
                        </Button>

                        <Button text smallIcon title="Exportar" color={activeTheme.queryEditor.bar.color}>
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

                        <Input
                          centerText
                          title="Limite"
                          defaultValue="200"
                          type="number"
                          maxWidth="80px"
                          color={activeTheme.queryEditor.bar.color}
                          backgroundColor={activeTheme.queryEditor.bar.fieldBackgroundColor}
                          placeholderColor={activeTheme.queryEditor.bar.fieldPlaceholderColor}
                        />

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
