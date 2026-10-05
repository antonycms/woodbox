import React from 'react';
import IconMdiAlertCircle from '~icons/mdi/alert-circle';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { useAIChatPanelStore } from '@renderer/stores/AIChatPanel';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { useToastStore } from '@renderer/stores/Toast';
import { CopyIcon, IconAI } from '@renderer/styles/icons';
import styles from '../../styles.module.css';
import { IQueryResult } from '../../dtos';
import { toDateTime } from '@renderer/utils/date';
import { getErrorMessage } from '@shared/utils/error';

interface ITabContentError {
  data: IQueryResult;
}

export const TabcontentError = (props: ITabContentError) => {
  const { data } = props;
  const t = useI18nStore((state) => state.t);
  const startNewChatWithMessage = useAIChatPanelStore((state) => state.startNewChatWithMessage);
  const showToast = useToastStore((state) => state.showToast);
  const { queryEditor: theme } = useThemeStore((state) => state.activeTheme);
  const errorMessage = data.message || t('common.unknownErrorNoDot');
  const style = {
    '--errorBorderColor': theme.error.borderColor,
    '--errorAccentColor': theme.error.accentColor,
    '--errorBackgroundColor': theme.error.backgroundColor,
    '--errorMessageBackgroundColor': theme.error.messageBackgroundColor,
  } as React.CSSProperties;

  const copyError = React.useCallback(async () => {
    try {
      await navigator.clipboard.writeText(errorMessage);
      showToast({ type: 'success', title: t('query.errorCopied') });
    } catch (error) {
      showToast({
        type: 'error',
        title: t('query.errorCopyFailed'),
        description: getErrorMessage(error, String(error)),
      });
    }
  }, [errorMessage, showToast, t]);

  const analyzeErrorWithAI = React.useCallback(() => {
    startNewChatWithMessage(t('query.aiErrorPrompt'), [
      {
        title: t('query.aiErrorQueryContextTitle'),
        content: data.query,
        language: 'sql',
      },
      {
        title: t('query.aiErrorMessageContextTitle'),
        content: errorMessage,
      },
    ]);
  }, [data.query, errorMessage, startNewChatWithMessage, t]);

  return (
    <div className={styles.resultContainer}>
      <div className={styles.resultCard} style={style}>
        <div className={styles.resultHeader}>
          <div className={styles.resultHeaderTitle}>
            <IconMdiAlertCircle width={18} height={18} />

            <Text bold color={theme.error.accentColor}>
              {t('query.executionErrorTitle')}
            </Text>
          </div>

          <div className={styles.resultActions}>
            <Button
              text
              smallIcon
              color={theme.error.accentColor}
              title={t('query.copyError')}
              onClick={copyError}
            >
              <CopyIcon size={15} />
            </Button>

            <Button
              text
              smallIcon
              color={theme.error.accentColor}
              title={t('query.analyzeErrorWithAI')}
              onClick={analyzeErrorWithAI}
            >
              <IconAI size={15} />
            </Button>
          </div>
        </div>

        <Text small color={theme.error.mutedColor}>
          {t('query.executedAt', { date: toDateTime(data.date_run) })}
        </Text>

        <div className={styles.resultMessage}>
          <Text color={theme.error.messageColor}>{errorMessage}</Text>
        </div>
      </div>
    </div>
  );
};
