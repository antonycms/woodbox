import React from 'react';
import type { IButtonDropdownOption } from '@renderer/components/ButtonDropdown';
import ResizableContainer from '@renderer/components/ResizableContainer';
import * as centralSearchConstants from '@renderer/components/CentralSearchModal/constants';
import { useAIChatPanelContext } from '@renderer/contexts/AIChatPanel';
import { useAppTabContext } from '@renderer/contexts/AppTab';
import { useI18n } from '@renderer/contexts/I18n';
import { type IAIChat, useStoreContext } from '@renderer/contexts/Store';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import useDebounce from '@renderer/hooks/useDebounce';
import useStorage from '@renderer/hooks/useStorage';
import { IconAI } from '@renderer/styles/icons';
import FunctionInfo from '@renderer/views/FunctionInfo';
import TableInfo from '@renderer/views/TableInfo';
import AIChat from './components/AIChat';
import { AIChatEmptyState } from './components/AIChatEmptyState';
import { ModalAIProviders } from './components/ModalAIProviders';
import { ModalDeleteAIChat } from './components/ModalDeleteAIChat';
import { useAIModelSelection } from './hooks/useAIModelSelection';
import type {
  IAIChatDraftContext,
  IAIChatModelSelection,
  IAIChatReferenceOption,
} from './types';
import { buildAIChatMessageContent } from './utils/draftContexts';
import styles from './styles.module.css';

export const AIChatPanel = React.memo(() => {
  const { t } = useI18n();
  const {
    activeChatId,
    clearEditorContextRequest,
    closeChatPanel,
    editorContextRequest,
    openChatPanel,
    toggleChatPanel,
    visible,
  } = useAIChatPanelContext();
  const { activeTabId, addTab, getTab, setActiveTabId, tabs } = useAppTabContext();
  const {
    aiChats,
    aiProviders,
    addAIChat,
    connections,
    connectionsGroupPerProject,
    connectionsInfo,
    editAIChat,
    loadConnectionInfo,
    removeAIChat,
  } = useStoreContext();
  const { showToast } = useToast();
  const {
    activeTheme: { __colors, mainTab: theme },
  } = useThemeContext();
  const [width, _setWidth] = useStorage('ai_chat_panel_width', 430);
  const [emptyDraft, setEmptyDraft] = React.useState('');
  const [initialMessage, setInitialMessage] = React.useState('');
  const [chatDraftContexts, setChatDraftContexts] = React.useState<IAIChatDraftContext[]>([]);
  const [emptyDraftContexts, setEmptyDraftContexts] = React.useState<IAIChatDraftContext[]>([]);
  const [draftNewChat, setDraftNewChat] = React.useState(false);
  const [showProvidersModal, setShowProvidersModal] = React.useState(false);
  const [chatToRemove, setChatToRemove] = React.useState<IAIChat>();
  const [emptyAISelection, setEmptyAISelection] = React.useState<IAIChatModelSelection>();
  const [selectedConnectionId, setSelectedConnectionId] = React.useState<string>();
  const manualConnectionSelectionRef = React.useRef(false);
  const loadingConnectionRef = React.useRef(new Set<string>());
  const setWidth = useDebounce(_setWidth);

  const activeChat = React.useMemo(
    () => aiChats.find((chat) => chat.id === activeChatId),
    [activeChatId, aiChats],
  );
  const visibleChat = draftNewChat ? undefined : activeChat;
  const activeTabConnectionId = React.useMemo(() => {
    const activeTab = tabs.find((tab) => tab.id === activeTabId);

    if (!activeTab?.data || !('id_connection' in activeTab.data)) return undefined;

    return activeTab.data.id_connection;
  }, [activeTabId, tabs]);
  const connectionIds = React.useMemo(
    () => new Set(connections.map((connection) => connection.id)),
    [connections],
  );
  const savedChatConnectionId = React.useMemo(() => {
    if (!visibleChat?.connectionId || !connectionIds.has(visibleChat.connectionId)) {
      return undefined;
    }

    return visibleChat.connectionId;
  }, [connectionIds, visibleChat?.connectionId]);
  const preferredConnectionId = React.useMemo(() => {
    if (savedChatConnectionId) return savedChatConnectionId;

    if (activeTabConnectionId && connectionIds.has(activeTabConnectionId)) {
      return activeTabConnectionId;
    }

    const sidebarActiveConnection = connectionsGroupPerProject
      .flatMap((project) => project.connections)
      .find((connection) => connectionsInfo.has(connection.id));

    if (sidebarActiveConnection) return sidebarActiveConnection.id;

    return connections.find((connection) => connectionsInfo.has(connection.id))?.id;
  }, [
    activeTabConnectionId,
    connectionIds,
    connections,
    connectionsGroupPerProject,
    connectionsInfo,
    savedChatConnectionId,
  ]);
  const connectionOptions = React.useMemo(
    () =>
      connections.map((connection) => ({
        id: connection.id,
        label: connection.description || connection.database || connection.host || connection.id,
        meta: [connection.database, connection.dialect, connection.host].filter(Boolean).join(' · '),
      })),
    [connections],
  );
  const referenceOptions = React.useMemo<IAIChatReferenceOption[]>(() => {
    const connectionInfo = selectedConnectionId
      ? connectionsInfo.get(selectedConnectionId)
      : undefined;

    const tableOptions = (connectionInfo?.tables || []).map((table) => {
      const tableName = [table.table_schema, table.table_name].filter(Boolean).join('.');

      return {
        id: tableName,
        label: `@${tableName}`,
        meta: table.object_type || 'table',
        idConnection: selectedConnectionId,
        type: 'table' as const,
        schema: table.table_schema,
        table: table.table_name,
        objectType: table.object_type,
        supportsIndexes: table.supports_indexes,
        supportsTriggers: table.supports_triggers,
      };
    });

    const functionOptions = (connectionInfo?.functions || []).map((fn) => {
      const functionName = [fn.function_schema, fn.function_name].filter(Boolean).join('.');

      return {
        id: functionName,
        label: `@${functionName}`,
        meta: 'function',
        idConnection: selectedConnectionId,
        type: 'function' as const,
        schema: fn.function_schema,
        functionName: fn.function_name,
      };
    });

    return [...tableOptions, ...functionOptions];
  }, [connectionsInfo, selectedConnectionId]);

  const openReference = React.useCallback(
    (option: IAIChatReferenceOption) => {
      if (option.type === 'function' && option.functionName) {
        const tabId = centralSearchConstants.getFunctionTabId(
          option.idConnection,
          option.schema,
          option.functionName,
        );
        const tab = getTab(tabId);

        if (tab) return setActiveTabId(tabId);

        addTab({
          id: tabId,
          title: centralSearchConstants.getQualifiedName(option.schema, option.functionName),
          data: {
            type: 'function-info',
            id_connection: option.idConnection,
            schema: option.schema,
            function_name: option.functionName,
          },
          component: () => (
            <FunctionInfo
              id_connection={option.idConnection}
              schema={option.schema}
              function_name={option.functionName}
            />
          ),
        });
        return;
      }

      if (!option.table) return;

      const tabId = centralSearchConstants.getTableTabId(
        option.idConnection,
        option.schema,
        option.table,
      );
      const tab = getTab(tabId);

      if (tab) return setActiveTabId(tabId);

      addTab({
        id: tabId,
        title: centralSearchConstants.getQualifiedName(option.schema, option.table),
        data: {
          type: 'table-info',
          id_connection: option.idConnection,
          schema: option.schema,
          table: option.table,
          objectType: option.objectType,
          supportsIndexes: option.supportsIndexes,
          supportsTriggers: option.supportsTriggers,
        },
        component: () => (
          <TableInfo
            id_connection={option.idConnection}
            schema={option.schema}
            table={option.table}
            appTabId={tabId}
            objectType={option.objectType}
            supportsIndexes={option.supportsIndexes}
            supportsTriggers={option.supportsTriggers}
          />
        ),
      });
    },
    [addTab, getTab, setActiveTabId],
  );

  const handleChatModelChange = React.useCallback(
    async (providerId: string, model: string) => {
      if (!visibleChat) return;

      try {
        await editAIChat(visibleChat.id, { providerId, model });
      } catch (error) {
        showToast({
          type: 'error',
          title: t('aiProvider.selectModelFailed'),
          description: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [editAIChat, showToast, t, visibleChat],
  );

  const handleEmptyChatModelChange = React.useCallback((providerId: string, model: string) => {
    setEmptyAISelection({ providerId, model });
  }, []);

  const handleConnectionChange = React.useCallback(
    async (connectionId: string) => {
      manualConnectionSelectionRef.current = true;
      setSelectedConnectionId(connectionId);

      if (!visibleChat || visibleChat.connectionId === connectionId) return;

      try {
        await editAIChat(visibleChat.id, { connectionId });
      } catch (error) {
        showToast({
          type: 'error',
          title: t('aiChat.saveConnectionFailed'),
          description: error instanceof Error ? error.message : String(error),
        });
      }
    },
    [editAIChat, showToast, t, visibleChat],
  );

  const activeChatModelSelection = useAIModelSelection({
    aiProviders,
    chat: visibleChat,
    onModelChange: handleChatModelChange,
  });

  const emptyChatModelSelection = useAIModelSelection({
    aiProviders,
    chats: aiChats,
    selection: emptyAISelection,
    onModelChange: handleEmptyChatModelChange,
  });

  const optionsMenu = React.useMemo(
    () => [
      { id: 'new-chat', label: t('aiChat.new') },
      { id: 'providers', label: t('aiProvider.configureProviders') },
    ],
    [t],
  );

  const selectChat = React.useCallback(
    (chat: IAIChat) => {
      setDraftNewChat(false);
      openChatPanel(chat.id);
    },
    [openChatPanel],
  );

  const createChat = React.useCallback(async () => {
    try {
      const chat = await addAIChat({
        title: t('aiChat.newTitle'),
        summary: t('aiChat.newSummary'),
        providerId: emptyChatModelSelection.selectedProviderId,
        model: emptyChatModelSelection.selectedModel,
        connectionId: selectedConnectionId,
      });

      setEmptyAISelection(undefined);
      selectChat(chat);
    } catch (error) {
      showToast({
        type: 'error',
        title: t('aiChat.createFailed'),
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [
    addAIChat,
    emptyChatModelSelection.selectedModel,
    emptyChatModelSelection.selectedProviderId,
    selectChat,
    selectedConnectionId,
    showToast,
    t,
  ]);

  const handleSelectOption = React.useCallback(
    (option: IButtonDropdownOption) => {
      if (option.id === 'new-chat') {
        setDraftNewChat(true);
        setInitialMessage('');
        setChatDraftContexts([]);
        setEmptyAISelection(undefined);
      }
      if (option.id === 'providers') setShowProvidersModal(true);
    },
    [],
  );

  const handleTogglePanel = React.useCallback(() => {
    toggleChatPanel();
  }, [toggleChatPanel]);

  const handleEmptySubmit = React.useCallback(
    async (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (
        (!emptyDraft.trim() && !emptyDraftContexts.length) ||
        !emptyChatModelSelection.selectedProviderId ||
        !emptyChatModelSelection.selectedModel ||
        !selectedConnectionId
      ) {
        return;
      }

      setInitialMessage(buildAIChatMessageContent(emptyDraft, emptyDraftContexts));
      await createChat();
      setEmptyDraft('');
      setEmptyDraftContexts([]);
    },
    [
      createChat,
      emptyChatModelSelection.selectedModel,
      emptyChatModelSelection.selectedProviderId,
      emptyDraft,
      emptyDraftContexts,
      selectedConnectionId,
    ],
  );

  const confirmRemoveChat = React.useCallback(async () => {
    if (!chatToRemove) return;

    await removeAIChat(chatToRemove.id);
    if (chatToRemove.id === activeChatId) setDraftNewChat(true);
    setChatToRemove(undefined);
  }, [activeChatId, chatToRemove, removeAIChat]);

  React.useEffect(() => {
    manualConnectionSelectionRef.current = false;
  }, [visibleChat?.id]);

  React.useEffect(() => {
    if (!editorContextRequest) return;

    const context: IAIChatDraftContext = {
      id: editorContextRequest.id,
      title: t('aiChat.editorContextLabel'),
      content: editorContextRequest.content,
      language: editorContextRequest.language,
    };

    if (activeChat) {
      setDraftNewChat(false);
      setChatDraftContexts((prevState) => [...prevState, context]);
      openChatPanel(activeChat.id);
    } else {
      setDraftNewChat(true);
      setInitialMessage('');
      setEmptyAISelection(undefined);
      setEmptyDraftContexts((prevState) => [...prevState, context]);
    }

    clearEditorContextRequest();
  }, [
    activeChat,
    clearEditorContextRequest,
    editorContextRequest,
    openChatPanel,
    t,
  ]);

  React.useEffect(() => {
    if (!visible) {
      manualConnectionSelectionRef.current = false;
      return;
    }

    if (selectedConnectionId && !connectionIds.has(selectedConnectionId)) {
      manualConnectionSelectionRef.current = false;
      setSelectedConnectionId(preferredConnectionId);
      return;
    }

    if (!manualConnectionSelectionRef.current && selectedConnectionId !== preferredConnectionId) {
      setSelectedConnectionId(preferredConnectionId);
    }
  }, [connectionIds, preferredConnectionId, selectedConnectionId, visible]);

  React.useEffect(() => {
    if (!visible || !selectedConnectionId || connectionsInfo.has(selectedConnectionId)) return;
    if (loadingConnectionRef.current.has(selectedConnectionId)) return;

    loadingConnectionRef.current.add(selectedConnectionId);

    loadConnectionInfo(selectedConnectionId)
      .catch((error) => {
        showToast({
          type: 'error',
          title: t('toast.connectionError'),
          description: error instanceof Error ? error.message : String(error),
        });
      })
      .finally(() => {
        loadingConnectionRef.current.delete(selectedConnectionId);
      });
  }, [connectionsInfo, loadConnectionInfo, selectedConnectionId, showToast, t, visible]);

  return (
    <>
      {!visible && (
        <button
          className={styles.toggleButton}
          type="button"
          title={t('aiChat.togglePanel')}
          aria-label={t('aiChat.togglePanel')}
          style={
            {
              '--borderColor': theme.bar.borderColor,
              '--backgroundColor': theme.backgroundColor,
              '--color': theme.color,
              '--ascentColor': theme.ascentColor,
            } as React.CSSProperties
          }
          onClick={handleTogglePanel}
        >
          <IconAI size={18} />
        </button>
      )}

      {visible && (
        <>
          <ModalDeleteAIChat
            chat={chatToRemove}
            onClose={() => setChatToRemove(undefined)}
            onConfirm={confirmRemoveChat}
          />

          <ModalAIProviders
            show={showProvidersModal}
            onClose={() => setShowProvidersModal(false)}
          />

          <ResizableContainer
            minWidth={320}
            maxWidth={520}
            width={width}
            horizontalResizeSide="left"
            className={styles.container}
            style={
              {
                '--borderColor': theme.bar.borderColor,
                '--backgroundColor': theme.backgroundColor,
                '--cardBackgroundColor': __colors.darkLightDeep,
                '--color': theme.color,
                '--ascentColor': theme.ascentColor,
                '--aiChatPanelWidth': `${width}px`,
                '--mutedColor': __colors.gray,
                '--sendBackgroundColor': __colors.green,
                '--sendColor': __colors.dark,
                '--sendDisabledBackgroundColor': __colors.gray,
                '--sendDisabledColor': __colors.white,
                '--queryRejectedColor': __colors.red,
              } as React.CSSProperties
            }
            onResize={(size) => {
              if (size.width) setWidth(size.width);
            }}
          >
            <div className={styles.panelContent}>
              <section className={styles.chatArea}>
                {visibleChat ? (
                  <AIChat
                    id_chat={visibleChat.id}
                    initialMessage={initialMessage}
                    draftContexts={chatDraftContexts}
                    connectionOptions={connectionOptions}
                    referenceOptions={referenceOptions}
                    menuOptions={optionsMenu}
                    modelSelection={activeChatModelSelection}
                    selectedConnectionId={selectedConnectionId}
                    onClose={closeChatPanel}
                    onConnectionChange={handleConnectionChange}
                    onClearDraftContexts={() => setChatDraftContexts([])}
                    onOpenReference={openReference}
                    onRemoveDraftContext={(contextId) =>
                      setChatDraftContexts((prevState) =>
                        prevState.filter((context) => context.id !== contextId),
                      )
                    }
                    onInitialMessageHandled={() => setInitialMessage('')}
                    onNewChat={() => {
                      setDraftNewChat(true);
                      setInitialMessage('');
                      setChatDraftContexts([]);
                      setEmptyAISelection(undefined);
                    }}
                    onSelectMenuOption={handleSelectOption}
                  />
                ) : (
                  <AIChatEmptyState
                    value={emptyDraft}
                    contexts={emptyDraftContexts}
                    connectionOptions={connectionOptions}
                    referenceOptions={referenceOptions}
                    menuOptions={optionsMenu}
                    modelSelection={emptyChatModelSelection}
                    selectedConnectionId={selectedConnectionId}
                    onChange={setEmptyDraft}
                    onClose={closeChatPanel}
                    onConnectionChange={handleConnectionChange}
                    onDeleteChat={setChatToRemove}
                    onOpenReference={openReference}
                    onRemoveContext={(contextId) =>
                      setEmptyDraftContexts((prevState) =>
                        prevState.filter((context) => context.id !== contextId),
                      )
                    }
                    onSelectChat={selectChat}
                    onSelectMenuOption={handleSelectOption}
                    onSubmit={handleEmptySubmit}
                  />
                )}
              </section>
            </div>
          </ResizableContainer>
        </>
      )}
    </>
  );
});

AIChatPanel.displayName = 'AIChatPanel';
