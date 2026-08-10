import React from 'react';
import type { IButtonDropdownOption } from '@renderer/components/ButtonDropdown';
import ResizableContainer from '@renderer/components/ResizableContainer';
import { useAIChatPanelContext } from '@renderer/contexts/AIChatPanel';
import { useI18n } from '@renderer/contexts/I18n';
import { type IAIChat, useStoreContext } from '@renderer/contexts/Store';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import useDebounce from '@renderer/hooks/useDebounce';
import useStorage from '@renderer/hooks/useStorage';
import { IconAI } from '@renderer/styles/icons';
import AIChat from './components/AIChat';
import { AIChatEmptyState } from './components/AIChatEmptyState';
import { ModalAIProviders } from './components/ModalAIProviders';
import { ModalDeleteAIChat } from './components/ModalDeleteAIChat';
import styles from './styles.module.css';

export const AIChatPanel = React.memo(() => {
  const { t } = useI18n();
  const { activeChatId, closeChatPanel, openChatPanel, toggleChatPanel, visible } =
    useAIChatPanelContext();
  const { aiChats, addAIChat, removeAIChat } = useStoreContext();
  const { showToast } = useToast();
  const {
    activeTheme: { __colors, mainTab: theme },
  } = useThemeContext();
  const [width, _setWidth] = useStorage('ai_chat_panel_width', 430);
  const [emptyDraft, setEmptyDraft] = React.useState('');
  const [initialMessage, setInitialMessage] = React.useState('');
  const [draftNewChat, setDraftNewChat] = React.useState(false);
  const [showProvidersModal, setShowProvidersModal] = React.useState(false);
  const [chatToRemove, setChatToRemove] = React.useState<IAIChat>();
  const setWidth = useDebounce(_setWidth);

  const activeChat = React.useMemo(
    () => aiChats.find((chat) => chat.id === activeChatId),
    [activeChatId, aiChats],
  );
  const visibleChat = draftNewChat ? undefined : activeChat;

  const recentChats = React.useMemo(() => aiChats.slice(0, 4), [aiChats]);

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
      });

      selectChat(chat);
    } catch (error) {
      showToast({
        type: 'error',
        title: t('aiChat.createFailed'),
        description: error instanceof Error ? error.message : String(error),
      });
    }
  }, [addAIChat, selectChat, showToast, t]);

  const handleSelectOption = React.useCallback(
    (option: IButtonDropdownOption) => {
      if (option.id === 'new-chat') {
        setDraftNewChat(true);
        setInitialMessage('');
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
      if (!emptyDraft.trim()) return;

      setInitialMessage(emptyDraft.trim());
      await createChat();
      setEmptyDraft('');
    },
    [createChat, emptyDraft],
  );

  const confirmRemoveChat = React.useCallback(async () => {
    if (!chatToRemove) return;

    await removeAIChat(chatToRemove.id);
    if (chatToRemove.id === activeChatId) setDraftNewChat(true);
    setChatToRemove(undefined);
  }, [activeChatId, chatToRemove, removeAIChat]);

  const formatChatAge = React.useCallback((date: string) => {
    const diffInMinutes = Math.max(1, Math.round((Date.now() - new Date(date).getTime()) / 60000));

    if (diffInMinutes < 60) return `${diffInMinutes} min`;

    const diffInHours = Math.round(diffInMinutes / 60);
    if (diffInHours < 24) return `${diffInHours} h`;

    return `${Math.round(diffInHours / 24)} d`;
  }, []);

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
                    menuOptions={optionsMenu}
                    onConfigureProviders={() => setShowProvidersModal(true)}
                    onClose={closeChatPanel}
                    onInitialMessageHandled={() => setInitialMessage('')}
                    onNewChat={() => {
                      setDraftNewChat(true);
                      setInitialMessage('');
                    }}
                    onSelectMenuOption={handleSelectOption}
                  />
                ) : (
                  <AIChatEmptyState
                    value={emptyDraft}
                    menuOptions={optionsMenu}
                    recentChats={recentChats}
                    formatChatAge={formatChatAge}
                    onChange={setEmptyDraft}
                    onClosePanel={closeChatPanel}
                    onDeleteChat={setChatToRemove}
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
