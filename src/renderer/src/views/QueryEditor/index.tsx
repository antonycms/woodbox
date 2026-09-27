import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import Editor, { IEditorRef, type IEditorContextMenu } from '@renderer/components/Editor';
import { TabBar, TabSplit } from '@renderer/components/Tabs';
import type { IContextMenuOption } from '@renderer/components/ContextMenu';
import type { IServerOutputMessage } from '@shared/types/database';
import ResizableContainer, { type OnResizeCallback } from '@renderer/components/ResizableContainer';
import useDebounce from '@renderer/hooks/useDebounce';
import useStorage from '@renderer/hooks/useStorage';
import { useAppTabStore } from '@renderer/stores/AppTab';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { useDatabaseStore } from '@renderer/stores/Database';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import useEditorCtrlClickNavigate from '@renderer/hooks/useEditorCtrlClickNavigate';
import { isPrimaryShortcutPressed } from '@renderer/utils/keyboard';
import { getRendererDialect } from '@renderer/database/dialects';
import { ModalExportData } from '@renderer/components/ModalExportData';
import ProcessList from '@renderer/views/ProcessList';
import { useQueryAutocomplete } from './hooks/useQueryAutocomplete';
import { useQueryResults } from './hooks/useQueryResults';
import { useQueryExecution } from './hooks/useQueryExecution';
import { useQueryRequests } from './hooks/useQueryRequests';
import { ModalQueryVariables } from './components/ModalQueryVariables';
import { ModalConfirmProductionQuery } from './components/ModalConfirmProductionQuery';
import { LateralBar } from './components/LateralBar';
import { QueryResultContent } from './components/QueryResultContent';
import { ModalServerOutput } from './components/ModalServerOutput';
import type { IQueryEditorProps } from './dtos';
import styles from './styles.module.css';

export const QueryEditor = ({ id_connection, id_script, isActiveTab = true }: IQueryEditorProps) => {
  const t = useI18nStore((state) => state.t);

  const onServerOutput = useDatabaseStore((state) => state.onServerOutput);
  
  const { editScript, getScriptContent, connections } = useWorkspaceStore(
    useShallow((state) => ({
      editScript: state.editScript,
      getScriptContent: state.getScriptContent,
      connections: state.connections,
    })),
  );

  const activeTheme = useThemeStore((state) => state.activeTheme);

  const {
    addTab,
    getTab,
    setActiveTabId,
  } = useAppTabStore(
    useShallow((state) => ({
      addTab: state.addTab,
      getTab: state.getTab,
      setActiveTabId: state.setActiveTabId,
    })),
  );

  const handleEditorCtrlClick = useEditorCtrlClickNavigate(id_connection);
  const currentConnection = React.useMemo(
    () => connections.find((connection) => connection.id === id_connection),
    [connections, id_connection],
  );
  const dialect = getRendererDialect(currentConnection?.dialect);
  const supportsProcessList =
    currentConnection?.dialect === 'postgres' || currentConnection?.dialect === 'mysql';
  const isProductionConnection = currentConnection?.environment === 'production';

  const refEditor = React.useRef<IEditorRef>(null);
  const hasLoadedScriptContentRef = React.useRef(false);
  const [sizeTabContent, _setSizeTabContent] = useStorage('editor_tab_result_height', 240);
  const setSizeTabContent = useDebounce(_setSizeTabContent);

  const [showServerOutputModal, setShowServerOutputModal] = React.useState(false);
  const [hasUnreadServerOutput, setHasUnreadServerOutput] = React.useState(false);
  const [isEditorReady, setIsEditorReady] = React.useState(false);

  const { autocomplete, tableReferences, handleUpdateCurrentQueryInfo } = useQueryAutocomplete(
    id_connection, currentConnection?.dialect,
  );

  const results = useQueryResults();
  
  const queryExecution = useQueryExecution({
    id_connection, refEditor, results, dialect: currentConnection?.dialect || 'postgres'
  });

  const queryRequests = useQueryRequests({
    id_connection, 
    isProductionConnection,
    executeQuery: queryExecution.executeQuery,
    executeExplainQuery: queryExecution.executeExplainQuery,
  });

  const {
    resultActiveTabId,
    setResultActiveTabId,
    tabsResult,
    querysResultData,
    toggleResultCapture,
    clearResultCapture,
    makeResultContextMenuOptions,
    handleRemoveResultTab,
  } = results;

  const {
    cancelingQueryIds,
    cancelResultQuery,
    refreshResultSqlTab,
    onScrollEnd,
    handleSortQueryResult,
  } = queryExecution
    
  const {
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
  } = queryRequests;

  const getSelectionsValues = () => {
    const selections = refEditor.current?.getSelections?.();

    const selectionsValue = selections
      ?.map?.((selection) => {
        return refEditor.current?.getSelectionValue?.(selection) || '';
      })
      .filter((value) => value?.trim?.());

    return selectionsValue;
  };

  const showServerOutput = React.useCallback(() => {
    setHasUnreadServerOutput(false);
    setShowServerOutputModal(true);
  }, []);

  const openProcessList = React.useCallback(() => {
    if (!supportsProcessList) return;

    const tabId = `process_list_${id_connection}`;
    const tab = getTab(tabId);

    if (tab) {
      setActiveTabId(tabId);
      return;
    }

    addTab({
      id: tabId,
      title: t('processList.title'),
      data: {
        type: 'process-list',
        id_connection,
      },
      component: () => <ProcessList id_connection={id_connection} />,
    });
  }, [addTab, getTab, id_connection, setActiveTabId, supportsProcessList, t]);

  const closeServerOutput = React.useCallback(() => {
    setShowServerOutputModal(false);
  }, []);

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

  const loadScriptContent = async () => {
    if (!id_script || !isEditorReady) return;

    const content = await getScriptContent(id_script);

    refEditor.current?.setValue?.(content);
    hasLoadedScriptContentRef.current = true;
  };

  const saveScript = useDebounce(() => {
    if (!id_script || !hasLoadedScriptContentRef.current) return;

    const content = refEditor.current?.getValue();

    editScript(id_script, { content, updated_at: new Date().toISOString() });
  }, 1000);

  const clearEditorErrorMarkers = React.useCallback(() => {
    refEditor.current?.setMarkers?.([]);
  }, []);

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

  const handleResizeResultTabs = React.useCallback<OnResizeCallback>(
    (size) => {
      setSizeTabContent(size.height);
    },
    [setSizeTabContent],
  );

  const runAllRef = React.useRef(runAllSQL);
  runAllRef.current = runAllSQL;

  const runSelectionsRef = React.useRef(runSelectionsSQL);
  runSelectionsRef.current = runSelectionsSQL;

  const runCurrentSQLRef = React.useRef(runCurrentSQL);
  runCurrentSQLRef.current = runCurrentSQL;

  const explainCurrentSQLRef = React.useRef(explainCurrentSQL);
  explainCurrentSQLRef.current = explainCurrentSQL;

  React.useEffect(() => {
    if (!refEditor.current?.element || !isEditorReady) return;

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
  }, [isEditorReady, refEditor.current?.element]);

  React.useEffect(() => {
    hasLoadedScriptContentRef.current = false;
    const timeout = setTimeout(loadScriptContent);

    return () => clearTimeout(timeout);
  }, [id_script, isEditorReady]);

  React.useEffect(() => {
    const removeListener = onServerOutput((message: IServerOutputMessage) => {
      if (message.connectionId !== id_connection || showServerOutputModal) return;

      setHasUnreadServerOutput(true);
    });

    return removeListener;
  }, [id_connection, onServerOutput, showServerOutputModal]);

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
          openProcessList={supportsProcessList ? openProcessList : undefined}
          hasUnreadServerOutput={hasUnreadServerOutput}
        />

        <Editor
          ref={refEditor}
          autoFocus
          dialect={dialect.editorDialect}
          onChange={saveScript}
          onChangeCurrentValue={handleUpdateCurrentQueryInfo}
          onDidChangeContent={clearEditorErrorMarkers}
          onReady={() => setIsEditorReady(true)}
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
            <TabSplit
              tabs={tabsResult}
              activeTabId={resultActiveTabId}
              onActiveTabIdChange={setResultActiveTabId}
              borderColor={activeTheme.queryEditor.tab.borderColor}
              backgroundColor={activeTheme.queryEditor.tab.bar.backgroundColor}
              contentBackgroundColor={activeTheme.queryEditor.tab.backgroundColor}
              renderTabContent={(tab) => {
                const data = querysResultData.get(tab.idTab);

                if (!data) return null;

                return (
                  <QueryResultContent
                    data={data}
                    id_connection={id_connection}
                    references={tableReferences}
                    onScrollEnd={() => onScrollEnd(tab.idTab)}
                    onRefresh={() => refreshResultSqlTab(tab.idTab)}
                    onCancelQuery={() => cancelResultQuery(tab.idTab)}
                    onToggleCapture={() => toggleResultCapture(tab.idTab)}
                    onClearCapture={() => clearResultCapture(tab.idTab)}
                    onSort={(column, sortType) =>
                      handleSortQueryResult(tab.idTab, column.attribute, sortType)
                    }
                    cancelingQuery={
                      !!data.queryExecutionId && cancelingQueryIds.has(data.queryExecutionId)
                    }
                  />
                );
              }}
              renderBar={({ paneTabs, tabBarProps }) => (
                <TabBar
                  {...tabBarProps}
                  borderTop
                  allowClose
                  draggable
                  borderBottom
                  onRemoveTab={handleRemoveResultTab}
                  contextMenuOptions={makeResultContextMenuOptions(paneTabs)}
                  ascentColor={activeTheme.queryEditor.tab.ascentColor}
                  backgroundColor={activeTheme.queryEditor.tab.backgroundColor}
                  backgroundColorBar={activeTheme.queryEditor.tab.bar.backgroundColor}
                  color={activeTheme.queryEditor.tab.color}
                  borderColor={activeTheme.queryEditor.tab.borderColor}
                />
              )}
            />
          </div>
        </ResizableContainer>
      )}
    </div>
  );
};
