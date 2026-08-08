import React from 'react';
import { Text } from '@renderer/components/Text';
import { VirtualizeList } from '@renderer/components/VirtualizeList';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { IconSend } from '@renderer/styles/icons';
import { getAIChatById, type IAIChatMessage } from '@renderer/utils/aiChats';
import styles from './styles.module.css';

interface IAIChatProps {
  id_chat: string;
}

const AIChat = ({ id_chat }: IAIChatProps) => {
  const { t } = useI18n();
  const {
    activeTheme: { __colors, mainTab: theme },
  } = useThemeContext();
  const [draftMessage, setDraftMessage] = React.useState('');
  const [localMessages, setLocalMessages] = React.useState<IAIChatMessage[]>([]);
  const messagesScrollRef = React.useRef<HTMLDivElement>(null);

  const chat = React.useMemo(() => getAIChatById(id_chat), [id_chat]);
  const title = chat ? chat.title : t('aiChat.unknownTitle');
  const summary = chat ? chat.summary : t('aiChat.unknownSummary');
  const messages = React.useMemo(
    () => [...(chat?.messages || []), ...localMessages],
    [chat, localMessages],
  );
  const canSendMessage = !!draftMessage.trim();

  const getMessageSize = React.useCallback(
    (index: number) => {
      const contentLength = messages[index]?.content.length || 0;

      return 72 + Math.ceil(contentLength / 90) * 22;
    },
    [messages],
  );

  const handleSubmitMessage = React.useCallback(
    (event: React.FormEvent<HTMLFormElement>) => {
      event.preventDefault();

      const content = draftMessage.trim();

      if (!content) return;

      setLocalMessages((prevState) => [
        ...prevState,
        {
          id: `local_${Date.now()}`,
          role: 'user',
          content,
        },
      ]);
      setDraftMessage('');
    },
    [draftMessage],
  );

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
        } as React.CSSProperties
      }
    >
      <header className={styles.header}>
        <div className={styles.titleBlock}>
          <Text bold color={theme.color} userSelect={false}>
            {title}
          </Text>
          <Text small color={theme.color} userSelect={false}>
            {summary}
          </Text>
        </div>
      </header>

      <main className={styles.content}>
        <section className={styles.chatPanel}>
          <div className={styles.messages}>
            {!messages.length && (
              <article className={styles.message}>
                <strong>{t('aiChat.emptyChatTitle')}</strong>
                <p>{t('aiChat.emptyChatDescription')}</p>
              </article>
            )}

            {!!messages.length && (
              <VirtualizeList
                refScrollElement={messagesScrollRef}
                itemCount={messages.length}
                itemSize={getMessageSize}
                style={{ padding: '18px 0 6px' }}
              >
                {({ index }) => {
                  const message = messages[index];

                  return (
                    <div className={styles.messageItem}>
                      <article
                        className={
                          message.role === 'user'
                            ? `${styles.message} ${styles.userMessage}`
                            : styles.message
                        }
                      >
                        <strong>
                          {message.role === 'assistant'
                            ? t('aiChat.agentLabel')
                            : t('aiChat.userLabel')}
                        </strong>
                        <p>{message.content}</p>
                      </article>
                    </div>
                  );
                }}
              </VirtualizeList>
            )}
          </div>

          <div className={styles.composer}>
            <form className={styles.composerForm} onSubmit={handleSubmitMessage}>
              <textarea
                value={draftMessage}
                placeholder={t('aiChat.composerPlaceholder')}
                aria-label={t('aiChat.composerPlaceholder')}
                onChange={(event) => setDraftMessage(event.target.value)}
              />

              <button
                className={styles.sendButton}
                type="submit"
                disabled={!canSendMessage}
                title={t('aiChat.send')}
                aria-label={t('aiChat.send')}
              >
                <IconSend size={22} />
              </button>
            </form>
          </div>
        </section>
      </main>
    </div>
  );
};

export default React.memo(AIChat);
