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
import { BackIcon, OptionsIcon } from '@renderer/styles/icons';
import { generateHash } from '@renderer/utils/string';
import { MessageContent } from './components/MessageContent';
import type { IQueryApprovalApproveOptions } from './components/QueryApprovalCards';
import { QueryResultTable } from './components/QueryResultTable';
import type { IAIChatProps } from './dtos';
import styles from './styles.module.css';
import {
  getResponseQueryApprovals,
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
import { buildAIChatMessageContent, getAIChatUserContent } from '../../utils/draftContexts';

const AIChat = ({
  id_chat,
  initialMessage,
  draftContexts = [],
  connectionOptions,
  referenceOptions,
  menuOptions,
  modelSelection,
  selectedConnectionId,
  onClose,
  onConnectionChange,
  onClearDraftContexts,
  onOpenReference,
  onRemoveDraftContext,
  onInitialMessageHandled,
  onNewChat,
  onSelectMenuOption,
}: IAIChatProps) => {
  const { t } = useI18n();
  const {
    aiChats,
    appendAIChatMessages,
    cancelAIChatMessage,
    connections,
    editAIChat,
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
  const stopGenerationRef = React.useRef(false);
  const activeAssistantMessageIdRef = React.useRef<string | undefined>(undefined);
  const activeRequestIdRef = React.useRef<string | undefined>(undefined);
  const chat = React.useMemo(() => aiChats.find((item) => item.id === id_chat), [aiChats, id_chat]);

  const title = chat ? chat.title : t('aiChat.unknownTitle');

  const messages = React.useMemo(
    () => [...(chat?.messages || []), ...localMessages],
    [chat, localMessages],
  );

  const canSendMessage =
    !!chat &&
    (!!draftMessage.trim() || !!draftContexts.length) &&
    !loadingMessage &&
    !!modelSelection.selectedProviderId &&
    !!modelSelection.selectedModel &&
    !!selectedConnectionId;

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

  const selectedConnectionIds = React.useMemo(
    () => (selectedConnectionId ? [selectedConnectionId] : []),
    [selectedConnectionId],
  );

  const submitMessageContent = React.useCallback(
    async (draftContent: string) => {
      const content = draftContent.trim();

      if (!content || loadingMessage || !selectedConnectionId) return;

      const persistedMessages = chat?.messages || [];
      const hasPendingApprovals = persistedMessages.some((message) =>
        message.queryApprovals?.some((approval) => !approval.status || approval.status === 'pending'),
      );
      const messagesWithoutPendingApprovals = hasPendingApprovals
        ? persistedMessages.map((message) => ({
            ...message,
            queryApprovals: message.queryApprovals?.map((approval) =>
              !approval.status || approval.status === 'pending'
                ? { ...approval, status: 'rejected' as const }
                : approval,
            ),
          }))
        : persistedMessages;

      if (hasPendingApprovals) {
        try {
          await editAIChat(id_chat, { messages: messagesWithoutPendingApprovals });
        } catch (error) {
          showToast({
            type: 'error',
            title: t('aiChat.sendFailed'),
            description: getErrorMessage(error),
          });
          return;
        }
      }

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
      const nextMessages = [...messagesWithoutPendingApprovals, ...localMessages, userMessage];
      const assistantMessageId = assistantMessage.id;
      const requestId = generateHash();

      stopGenerationRef.current = false;
      activeAssistantMessageIdRef.current = assistantMessageId;
      activeRequestIdRef.current = requestId;
      setLocalMessages((prevState) => [...prevState, userMessage, assistantMessage]);
      setDraftMessage('');
      onClearDraftContexts?.();

      try {
        setLoadingMessage(true);

        const response = await sendAIChatMessage({
          requestId,
          providerId: modelSelection.selectedProviderId,
          model: modelSelection.selectedModel,
          mentionedConnectionIds: selectedConnectionIds,
          messages: nextMessages.map((message) => ({
            role: message.role,
            content: message.content,
          })),
        });

        if (stopGenerationRef.current) return;

        const queryApprovals = getResponseQueryApprovals(
          response,
          selectedConnectionIds,
          connections,
        );
        const assistantContent =
          getAssistantContent(
            response.content,
            queryApprovals,
            t('aiChat.queryApprovalRequiredMessage'),
          ) || t('aiChat.queryApprovalRequiredMessage');
        const isFirstMessage = !chat?.messages.length;
        const titleContent = getAIChatUserContent(content);
        const nextTitle = isFirstMessage && titleContent ? getExcerpt(titleContent, 64) : undefined;

        const completedAt = new Date().toISOString();

        if (stopGenerationRef.current) return;

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
        if (stopGenerationRef.current) return;

        setLocalMessages((prevState) =>
          prevState.filter((message) => message.id !== assistantMessage.id),
        );
        showToast({
          type: 'error',
          title: t('aiChat.sendFailed'),
          description: getErrorMessage(error),
        });
      } finally {
        if (activeAssistantMessageIdRef.current === assistantMessageId) {
          setLoadingMessage(false);
          activeAssistantMessageIdRef.current = undefined;
          activeRequestIdRef.current = undefined;
        }
      }
    },
    [
      appendAIChatMessages,
      chat?.messages,
      connections,
      editAIChat,
      id_chat,
      loadingMessage,
      localMessages,
      modelSelection.selectedModel,
      modelSelection.selectedProviderId,
      onClearDraftContexts,
      sendAIChatMessage,
      selectedConnectionId,
      selectedConnectionIds,
      showToast,
      t,
    ],
  );

  const handleSubmitMessage = React.useCallback(
    async (event: React.SubmitEvent<HTMLFormElement>) => {
      event.preventDefault();

      await submitMessageContent(buildAIChatMessageContent(draftMessage, draftContexts));
    },
    [draftContexts, draftMessage, submitMessageContent],
  );

  const stopGeneration = React.useCallback(() => {
    stopGenerationRef.current = true;
    setLoadingMessage(false);

    const requestId = activeRequestIdRef.current;
    if (requestId) {
      cancelAIChatMessage(requestId).catch((error) => {
        console.error(error);
      });
    }
    activeRequestIdRef.current = undefined;

    const assistantMessageId = activeAssistantMessageIdRef.current;
    if (!assistantMessageId) return;

    setLocalMessages((prevState) =>
      prevState.filter((message) => message.id !== assistantMessageId),
    );
    activeAssistantMessageIdRef.current = undefined;
  }, [cancelAIChatMessage]);

  const updateQueryApproval = React.useCallback(
    async (approval: IAIQueryApproval, patch: Partial<IAIQueryApproval>) => {
      if (!chat) return [];

      const updatedMessages = chat.messages.map((message) => ({
        ...message,
        queryApprovals: message.queryApprovals?.map((item) =>
          item.id === approval.id ? { ...item, ...patch } : item,
        ),
      }));

      await editAIChat(id_chat, { messages: updatedMessages });

      return updatedMessages;
    },
    [chat, editAIChat, id_chat],
  );

  const rejectQueryApproval = React.useCallback(
    async (approval: IAIQueryApproval) => {
      await updateQueryApproval(approval, { status: 'rejected' });
    },
    [updateQueryApproval],
  );

  const approveQueryApproval = React.useCallback(
    async (approval: IAIQueryApproval, options?: IQueryApprovalApproveOptions) => {
      const executableApproval = {
        ...approval,
        sql: options?.sql?.trim() || approval.sql,
      };

      if (!isReadOnlySelectQuery(executableApproval.sql) && !options?.allowUnsafe) {
        showToast({
          type: 'error',
          title: t('aiChat.queryApprovalUnsafeTitle'),
          description: t('aiChat.queryApprovalUnsafeDescription'),
        });
        return;
      }

      const updatedMessages = await updateQueryApproval(executableApproval, {
        sql: executableApproval.sql,
        status: 'approved',
      });

      const userMessage: IAIChatMessage = {
        id: generateHash(),
        role: 'user',
        content: t('aiChat.queryApprovedMessage', {
          connection: executableApproval.connectionName,
        }),
        created_at: new Date().toISOString(),
      };

      const assistantMessage: IAIChatMessage = {
        id: generateHash(),
        role: 'assistant',
        content: t('aiChat.sending'),
        created_at: new Date().toISOString(),
      };

      const modelMessages = updatedMessages.filter((message) => !message.queryApprovals?.length);

      setLocalMessages((prevState) => [...prevState, userMessage, assistantMessage]);

      try {
        setLoadingMessage(true);
        const result = await runSql(executableApproval.connectionId, executableApproval.sql, {
          page: 1,
          limit: executableApproval.limit,
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
          content: serializeQueryResultForAI(executableApproval, result),
        };

        const response = await sendAIChatMessage({
          providerId: modelSelection.selectedProviderId,
          model: modelSelection.selectedModel,
          mentionedConnectionIds: [executableApproval.connectionId],
          messages: [
            ...modelMessages.map((message) => ({
              role: message.role,
              content: message.content,
            })),
            queryResultMessage,
          ],
        });

        const approvedSql = normalizeSqlForComparison(executableApproval.sql);

        const queryApprovals = getResponseQueryApprovals(
          response,
          [executableApproval.connectionId],
          connections,
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
      updateQueryApproval,
    ],
  );

  const handleComposerChange = React.useCallback((event: React.ChangeEvent<HTMLTextAreaElement>) => {
    setDraftMessage(event.target.value);
  }, []);

  const handleComposerPaste = React.useCallback(
    (event: React.ClipboardEvent<HTMLTextAreaElement>) => {
      const pastedText = event.clipboardData.getData('text');
      const sanitizedText = pastedText.trim();

      if (sanitizedText === pastedText) return;

      event.preventDefault();

      const { selectionStart, selectionEnd, value } = event.currentTarget;
      const nextDraftMessage = `${value.slice(0, selectionStart)}${sanitizedText}${value.slice(selectionEnd)}`;
      const nextCursor = selectionStart + sanitizedText.length;

      setDraftMessage(nextDraftMessage);

      window.requestAnimationFrame(() => {
        textareaRef.current?.setSelectionRange(nextCursor, nextCursor);
      });
    },
    [],
  );

  const handleComposerKeyDown = React.useCallback((event: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key !== 'Enter' || event.shiftKey || event.nativeEvent.isComposing) return;

    event.preventDefault();
    event.currentTarget.form?.requestSubmit();
  }, []);

  React.useEffect(() => {
    setLocalMessages([]);
  }, [id_chat]);

  React.useEffect(() => {
    if (!draftContexts.length) return;

    window.requestAnimationFrame(() => {
      textareaRef.current?.focus();
    });
  }, [draftContexts.length]);

  React.useEffect(() => {
    if (!initialMessage || handledInitialMessageRef.current === initialMessage || loadingMessage) {
      return;
    }

    handledInitialMessageRef.current = initialMessage;
    submitMessageContent(initialMessage);
    onInitialMessageHandled?.();
  }, [initialMessage, loadingMessage, onInitialMessageHandled, submitMessageContent]);

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
                          <MessageContent
                            content={message.content}
                            queryApprovals={message.queryApprovals}
                            onApprove={approveQueryApproval}
                            onReject={rejectQueryApproval}
                          />

                          <QueryResultTable result={message.queryResult} />
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
            loading={loadingMessage}
            contexts={draftContexts}
            connectionOptions={connectionOptions}
            referenceOptions={referenceOptions}
            modelGroups={modelSelection.modelGroups}
            selectedConnectionId={selectedConnectionId}
            selectedProviderId={modelSelection.selectedProviderId}
            selectedModel={modelSelection.selectedModel}
            onConnectionChange={onConnectionChange}
            onModelChange={modelSelection.onModelChange}
            onSubmit={handleSubmitMessage}
            onChange={handleComposerChange}
            onOpenReference={onOpenReference}
            onRemoveContext={onRemoveDraftContext}
            onStop={stopGeneration}
            onPaste={handleComposerPaste}
            onKeyDown={handleComposerKeyDown}
          />
        </section>
      </main>
    </div>
  );
};

export default React.memo(AIChat);
