import React from 'react';
import { AIChatComposer } from '../AIChatComposer';
import { ButtonDropdown } from '@renderer/components/ButtonDropdown';
import { useI18n } from '@renderer/contexts/I18n';
import {
  type IAIChatMessage,
  type IAIChatMessageInput,
  type IAIQueryApproval,
  useStoreContext,
} from '@renderer/contexts/Store';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import {
  BackIcon,
  OptionsIcon,
} from '@renderer/styles/icons';
import { generateHash } from '@renderer/utils/string';
import { MessageContent } from './components/MessageContent';
import { QueryApprovalCards } from './components/QueryApprovalCards';
import { QueryResultTable } from './components/QueryResultTable';
import type { IAIChatProps } from './dtos';
import { useConnectionMentions } from './hooks/useConnectionMentions';
import styles from './styles.module.css';
import { getConnectionMention, getMentionedConnectionIdsFromText } from './utils/mentions';
import {
  buildFallbackQueryApprovals,
  isReadOnlySelectQuery,
  normalizeSqlForComparison,
} from './utils/queryApprovals';
import {
  getAssistantContent,
  getErrorMessage,
  getExcerpt,
  getQueryResultForTable,
  serializeQueryResultForAI,
} from './utils/messages';

const AIChat = ({
  id_chat,
  initialMessage,
  menuOptions,
  modelSelection,
  onClose,
  onInitialMessageHandled,
  onNewChat,
  onSelectMenuOption,
}: IAIChatProps) => {
  const { t } = useI18n();
  const {
    aiChats,
    appendAIChatMessages,
    connections,
    connectionsInfo,
    editAIChat,
    loadConnectionInfo,
    runSql,
    sendAIChatMessage,
  } = useStoreContext();
  const { showToast } = useToast();
  const {
    activeTheme: { __colors, mainTab: theme },
  } = useThemeContext();
  const [draftMessage, setDraftMessage] = React.useState('');
  const [localMessages, setLocalMessages] = React.useState<IAIChatMessage[]>([]);
  const [loadingMessage, setLoadingMessage] = React.useState(false);
  const messagesScrollRef = React.useRef<HTMLDivElement>(null);
  const textareaRef = React.useRef<HTMLTextAreaElement>(null);
  const handledInitialMessageRef = React.useRef<string | undefined>(undefined);
  const loadingMentionConnectionsRef = React.useRef(new Set<string>());
  const chat = React.useMemo(() => aiChats.find((item) => item.id === id_chat), [aiChats, id_chat]);

  const title = chat ? chat.title : t('aiChat.unknownTitle');

  const messages = React.useMemo(
    () => [...(chat?.messages || []), ...localMessages],
    [chat, localMessages],
  );

  const canSendMessage =
    !!chat &&
    !!draftMessage.trim() &&
    !loadingMessage &&
    !!modelSelection.selectedProviderId &&
    !!modelSelection.selectedModel;

  const formatWorkDuration = React.useCallback(
    (startedAt?: string, finishedAt?: string) => {
      const startedAtTime = startedAt ? new Date(startedAt).getTime() : Date.now();
      const finishedAtTime = finishedAt ? new Date(finishedAt).getTime() : Date.now();
      const totalSeconds = Math.max(1, Math.round((finishedAtTime - startedAtTime) / 1000));

      if (totalSeconds < 60) {
        return t('aiChat.duration.seconds', { count: totalSeconds });
      }

      const minutes = Math.floor(totalSeconds / 60);
      const seconds = totalSeconds % 60;

      if (minutes < 60) {
        return t('aiChat.duration.minutes', { minutes, seconds });
      }

      const hours = Math.floor(minutes / 60);

      return t('aiChat.duration.hours', { hours, minutes: minutes % 60 });
    },
    [t],
  );

  const getWorkDuration = React.useCallback(
    (message: IAIChatMessage, index: number) => {
      const previousUserMessage = messages
        .slice(0, index)
        .reverse()
        .find((item) => item.role === 'user');

      if (!previousUserMessage) return undefined;

      return formatWorkDuration(previousUserMessage.created_at, message.created_at);
    },
    [formatWorkDuration, messages],
  );

  const messageConnectionIds = React.useMemo(
    () => [
      ...new Set(
        messages.flatMap((message) =>
          getMentionedConnectionIdsFromText(message.content, connections),
        ),
      ),
    ],
    [connections, messages],
  );
  const {
    highlightedMentionIndex,
    mentionSuggestions,
    mentionedConnectionIds,
    selectedMentionConnections,
    handleComposerChange,
    handleComposerPaste,
    handleMentionNavigationKeyDown,
    removeSelectedMention,
    resetSelectedMentions,
    selectConnectionMention,
    setHighlightedMentionIndex,
    updateActiveMentionFromTextarea,
  } = useConnectionMentions({
    connections,
    draftMessage,
    setDraftMessage,
    textareaRef,
  });

  const submitMessageContent = React.useCallback(
    async (draftContent: string) => {
      const selectedMentionsText = selectedMentionConnections.map(getConnectionMention).join(' ');
      const content = [selectedMentionsText, draftContent].filter(Boolean).join(' ').trim();

      if (!draftContent || loadingMessage) return;

      const userMessage: IAIChatMessage = {
        id: generateHash(),
        role: 'user',
        content,
        created_at: new Date().toISOString(),
      };
      const assistantMessage: IAIChatMessage = {
        id: generateHash(),
        role: 'assistant',
        content: t('aiChat.sending'),
        created_at: new Date().toISOString(),
      };
      const nextMessages = [...messages, userMessage];

      setLocalMessages((prevState) => [...prevState, userMessage, assistantMessage]);
      setDraftMessage('');
      resetSelectedMentions();

      try {
        setLoadingMessage(true);

        const response = await sendAIChatMessage({
          providerId: modelSelection.selectedProviderId,
          model: modelSelection.selectedModel,
          mentionedConnectionIds,
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        });

        const queryApprovals = buildFallbackQueryApprovals(
          response.content,
          mentionedConnectionIds,
          connections,
          nextMessages,
        );
        const assistantContent =
          getAssistantContent(
            response.content,
            queryApprovals,
            t('aiChat.queryApprovalRequiredMessage'),
          ) || t('aiChat.queryApprovalRequiredMessage');
        const isFirstMessage = !chat?.messages.length;
        const nextTitle = isFirstMessage ? getExcerpt(content, 64) : undefined;

        const completedAt = new Date().toISOString();

        await appendAIChatMessages(id_chat, {
          title: nextTitle,
          summary: isFirstMessage ? getExcerpt(assistantContent, 96) : undefined,
          messages: [
            userMessage,
            {
              ...assistantMessage,
              content: assistantContent,
              created_at: completedAt,
              queryApprovals,
            },
          ],
        });

        setLocalMessages((prevState) =>
          prevState.filter(
            (message) => ![userMessage.id, assistantMessage.id].includes(message.id),
          ),
        );
      } catch (error) {
        setLocalMessages((prevState) =>
          prevState.filter((message) => message.id !== assistantMessage.id),
        );
        showToast({
          type: 'error',
          title: t('aiChat.sendFailed'),
          description: getErrorMessage(error),
        });
      } finally {
        setLoadingMessage(false);
      }
    },
    [
      appendAIChatMessages,
      chat?.messages.length,
      connections,
      id_chat,
      loadingMessage,
      mentionedConnectionIds,
      messages,
      resetSelectedMentions,
      modelSelection.selectedModel,
      modelSelection.selectedProviderId,
      sendAIChatMessage,
      selectedMentionConnections,
      showToast,
      t,
    ],
  );

  const handleSubmitMessage = React.useCallback(
    async (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();

      await submitMessageContent(draftMessage.trim());
    },
    [draftMessage, submitMessageContent],
  );

  const updateApprovalStatus = React.useCallback(
    async (approval: IAIQueryApproval, status: NonNullable<IAIQueryApproval['status']>) => {
      if (!chat) return [];

      const updatedMessages = chat.messages.map((message) => ({
        ...message,
        queryApprovals: message.queryApprovals?.map((item) =>
          item.id === approval.id ? { ...item, status } : item,
        ),
      }));

      await editAIChat(id_chat, { messages: updatedMessages });

      return updatedMessages;
    },
    [chat, editAIChat, id_chat],
  );

  const rejectQueryApproval = React.useCallback(
    async (approval: IAIQueryApproval) => {
      await updateApprovalStatus(approval, 'rejected');
    },
    [updateApprovalStatus],
  );

  const approveQueryApproval = React.useCallback(
    async (approval: IAIQueryApproval) => {
      if (!isReadOnlySelectQuery(approval.sql)) {
        showToast({
          type: 'error',
          title: t('aiChat.queryApprovalUnsafeTitle'),
          description: t('aiChat.queryApprovalUnsafeDescription'),
        });
        return;
      }

      const updatedMessages = await updateApprovalStatus(approval, 'approved');

      const userMessage: IAIChatMessage = {
        id: generateHash(),
        role: 'user',
        content: t('aiChat.queryApprovedMessage', { connection: approval.connectionName }),
        created_at: new Date().toISOString(),
      };

      const assistantMessage: IAIChatMessage = {
        id: generateHash(),
        role: 'assistant',
        content: t('aiChat.sending'),
        created_at: new Date().toISOString(),
      };

      const nextMessages = [...updatedMessages, userMessage];
      const modelMessages = updatedMessages.filter((message) => !message.queryApprovals?.length);

      setLocalMessages((prevState) => [...prevState, userMessage, assistantMessage]);

      try {
        setLoadingMessage(true);
        const result = await runSql(approval.connectionId, approval.sql, {
          page: 1,
          limit: approval.limit,
        });
        const queryResult = getQueryResultForTable(result);

        if (queryResult) {
          const completedAt = new Date().toISOString();

          await appendAIChatMessages(id_chat, {
            messages: [
              userMessage,
              { ...assistantMessage, queryResult, content: '', created_at: completedAt },
            ],
          });

          setLocalMessages((prevState) =>
            prevState.filter(
              (message) => ![userMessage.id, assistantMessage.id].includes(message.id),
            ),
          );
          return;
        }

        const queryResultMessage: IAIChatMessageInput = {
          role: 'user',
          content: serializeQueryResultForAI(approval, result),
        };

        const response = await sendAIChatMessage({
          providerId: modelSelection.selectedProviderId,
          model: modelSelection.selectedModel,
          mentionedConnectionIds: [approval.connectionId],
          messages: [
            ...modelMessages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            queryResultMessage,
          ],
        });

        const approvedSql = normalizeSqlForComparison(approval.sql);

        const queryApprovals = buildFallbackQueryApprovals(
          response.content,
          [approval.connectionId],
          connections,
          nextMessages,
        ).filter((item) => normalizeSqlForComparison(item.sql) !== approvedSql);

        const completedAt = new Date().toISOString();

        await appendAIChatMessages(id_chat, {
          messages: [
            userMessage,
            {
              ...assistantMessage,
              created_at: completedAt,
              content:
                getAssistantContent(
                  response.content,
                  queryApprovals,
                  t('aiChat.queryApprovalRequiredMessage'),
                ) || t('aiChat.queryApprovalRequiredMessage'),
              queryApprovals,
              queryResult,
            },
          ],
        });

        setLocalMessages((prevState) =>
          prevState.filter(
            (message) => ![userMessage.id, assistantMessage.id].includes(message.id),
          ),
        );
      } catch (error) {
        setLocalMessages((prevState) =>
          prevState.filter((message) => message.id !== assistantMessage.id),
        );
        showToast({
          type: 'error',
          title: t('aiChat.sendFailed'),
          description: getErrorMessage(error),
        });
      } finally {
        setLoadingMessage(false);
      }
    },
    [
      appendAIChatMessages,
      connections,
      id_chat,
      runSql,
      modelSelection.selectedModel,
      modelSelection.selectedProviderId,
      sendAIChatMessage,
      showToast,
      t,
      updateApprovalStatus,
    ],
  );

  const handleComposerKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLTextAreaElement>) => {
      if (handleMentionNavigationKeyDown(event)) return;

      if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;

      event.preventDefault();
      event.currentTarget.form?.requestSubmit();
    },
    [handleMentionNavigationKeyDown],
  );

  React.useEffect(() => {
    setLocalMessages([]);
  }, [id_chat]);

  React.useEffect(() => {
    if (!initialMessage || handledInitialMessageRef.current === initialMessage || loadingMessage) {
      return;
    }

    handledInitialMessageRef.current = initialMessage;
    submitMessageContent(initialMessage);
    onInitialMessageHandled?.();
  }, [initialMessage, loadingMessage, onInitialMessageHandled, submitMessageContent]);

  React.useEffect(() => {
    const connectionIdsToLoad = [
      ...new Set([...mentionedConnectionIds, ...messageConnectionIds]),
    ].filter((id) => !connectionsInfo.has(id) && !loadingMentionConnectionsRef.current.has(id));

    if (!connectionIdsToLoad.length) return;

    connectionIdsToLoad.forEach((id) => loadingMentionConnectionsRef.current.add(id));

    Promise.allSettled(
      connectionIdsToLoad.map(async (id) => {
        try {
          await loadConnectionInfo(id);
        } finally {
          loadingMentionConnectionsRef.current.delete(id);
        }
      }),
    ).then((results) => {
      const rejected = results.find((result) => result.status === 'rejected');

      if (!rejected) return;

      showToast({
        type: 'error',
        title: t('toast.connectionError'),
        description: getErrorMessage(rejected.reason),
      });
    });
  }, [
    connectionsInfo,
    loadConnectionInfo,
    mentionedConnectionIds,
    messageConnectionIds,
    showToast,
    t,
  ]);

  React.useEffect(() => {
    window.requestAnimationFrame(() => {
      const scrollElement = messagesScrollRef.current;

      if (!scrollElement) return;

      scrollElement.scrollTop = scrollElement.scrollHeight;
    });
  }, [messages.length]);

  return (
    <div
      className={styles.container}
      style={
        {
          '--backgroundColor': theme.backgroundColor,
          '--barBackgroundColor': theme.bar.backgroundColor,
          '--borderColor': theme.borderColor,
          '--color': theme.color,
          '--ascentColor': theme.ascentColor,
          '--cardBackgroundColor': __colors.darkLightDeep,
          '--mutedColor': __colors.gray,
          '--sendBackgroundColor': __colors.green,
          '--sendColor': __colors.dark,
          '--sendDisabledBackgroundColor': __colors.gray,
          '--sendDisabledColor': __colors.white,
          '--queryPendingColor': __colors.orange,
          '--queryApprovedColor': __colors.green,
          '--queryRejectedColor': __colors.red,
        } as React.CSSProperties
      }
    >
      <header className={styles.header}>
        <button
          className={styles.iconButton}
          type="button"
          title={t('aiChat.new')}
          aria-label={t('aiChat.new')}
          onClick={onNewChat}
        >
          <BackIcon size={15} />
        </button>

        <p
          className={styles.titleBlock}
          title={t('aiChat.toggleList')}
          aria-label={t('aiChat.toggleList')}
        >
          {title}
        </p>

        {!!menuOptions?.length && (
          <ButtonDropdown
            smallIcon
            text
            title={t('aiProvider.options')}
            color={theme.color}
            icon={() => <OptionsIcon size={18} />}
            options={menuOptions}
            onSelect={onSelectMenuOption}
            align="right"
            dropdownBackground={__colors.darkLightDeep}
            dropdownColor={theme.color}
            dropdownHoverBackground={theme.backgroundColor}
          />
        )}

        {!!onClose && (
          <button
            className={[styles.iconButton, styles.closePanelButton].join(' ')}
            type="button"
            title={t('aiChat.closePanel')}
            aria-label={t('aiChat.closePanel')}
            onClick={onClose}
          >
            ×
          </button>
        )}
      </header>

      <main className={styles.content}>
        <section className={styles.chatPanel}>
          <div className={styles.messages} ref={messagesScrollRef}>
            {!!messages.length && (
              <div className={styles.messageList}>
                {messages.map((message, index) => {
                  const isAssistantLoadingMessage =
                    message.role === 'assistant' &&
                    message.content === t('aiChat.sending') &&
                    !message.queryApprovals?.length &&
                    !message.queryResult;

                  const workDuration =
                    message.role === 'assistant' && !isAssistantLoadingMessage
                      ? getWorkDuration(message, index)
                      : undefined;

                  return (
                    <React.Fragment key={message.id}>
                      {!!workDuration && (
                        <div className={styles.workDivider}>
                          <span>{t('aiChat.workedFor', { duration: workDuration })}</span>
                          <div className={styles.workDividerBar} />
                        </div>
                      )}

                      <div className={styles.messageItem}>
                        <article
                          className={[
                            styles.message,
                            message.role === 'assistant' && styles.assistantMessage,
                            message.role === 'user' && styles.userMessage,
                            message.queryResult && styles.tableMessage,
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <MessageContent content={message.content} connections={connections} />

                          <QueryResultTable result={message.queryResult} />
                          
                          {message.role === 'assistant' && (
                            <QueryApprovalCards
                              approvals={message.queryApprovals}
                              onApprove={approveQueryApproval}
                              onReject={rejectQueryApproval}
                            />
                          )}
                        </article>
                      </div>
                    </React.Fragment>
                  );
                })}
              </div>
            )}
          </div>

          <AIChatComposer
            textareaRef={textareaRef}
            value={draftMessage}
            canSubmit={canSendMessage}
            modelGroups={modelSelection.modelGroups}
            selectedProviderId={modelSelection.selectedProviderId}
            selectedModel={modelSelection.selectedModel}
            onModelChange={modelSelection.onModelChange}
            onSubmit={handleSubmitMessage}
            onChange={handleComposerChange}
            onPaste={handleComposerPaste}
            onClick={updateActiveMentionFromTextarea}
            onKeyUp={updateActiveMentionFromTextarea}
            onKeyDown={handleComposerKeyDown}
            mentionChips={
              !!selectedMentionConnections.length && (
                <div className={styles.mentionChips}>
                  {selectedMentionConnections.map((connection) => (
                    <span key={connection.id} className={styles.mentionChip}>
                      {getConnectionMention(connection)}
                      <button
                        type="button"
                        title={t('aiChat.removeConnectionMention', {
                          name: connection.description,
                        })}
                        aria-label={t('aiChat.removeConnectionMention', {
                          name: connection.description,
                        })}
                        onClick={() => removeSelectedMention(connection.id)}
                      >
                        ×
                      </button>
                    </span>
                  ))}
                </div>
              )
            }
            mentionDropdown={
              !!mentionSuggestions.length && (
                <div className={styles.mentionDropdown} role="listbox">
                  {mentionSuggestions.map((connection, index) => (
                    <button
                      key={connection.id}
                      type="button"
                      role="option"
                      aria-selected={index === highlightedMentionIndex}
                      className={
                        index === highlightedMentionIndex ? styles.mentionOptionActive : undefined
                      }
                      onMouseDown={(event) => event.preventDefault()}
                      onMouseEnter={() => setHighlightedMentionIndex(index)}
                      onClick={() => selectConnectionMention(connection)}
                    >
                      <strong>{getConnectionMention(connection)}</strong>
                      <span>
                        {[connection.description, connection.database, connection.dialect]
                          .filter(Boolean)
                          .join(' · ')}
                      </span>
                    </button>
                  ))}
                </div>
              )
            }
          />
        </section>
      </main>
    </div>
  );
};

export default React.memo(AIChat);
