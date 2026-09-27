import React from 'react';
import IconMdiAlertCircle from '~icons/mdi/alert-circle';
import { Text } from '@renderer/components/Text';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import styles from '../../styles.module.css';
import { IQueryResult } from '../../dtos';
import { toDateTime } from '@renderer/utils/date';

interface ITabContentError {
  data: IQueryResult;
}

export const TabcontentError = (props: ITabContentError) => {
  const { data } = props;
  const t = useI18nStore((state) => state.t);
  const { queryEditor: theme } = useThemeStore((state) => state.activeTheme);
  const style = {
    '--errorBorderColor': theme.error.borderColor,
    '--errorAccentColor': theme.error.accentColor,
    '--errorBackgroundColor': theme.error.backgroundColor,
    '--errorMessageBackgroundColor': theme.error.messageBackgroundColor,
  } as React.CSSProperties;

  return (
    <div className={styles.resultContainer}>
      <div className={styles.resultCard} style={style}>
        <div className={styles.resultHeader}>
          <IconMdiAlertCircle width={18} height={18} />

          <Text bold color={theme.error.accentColor}>
            {t('query.executionErrorTitle')}
          </Text>
        </div>

        <div className={styles.resultMessage}>
          <Text color={theme.error.messageColor}>{data.message || t('common.unknownErrorNoDot')}</Text>
        </div>

        <Text small color={theme.error.mutedColor}>
          {t('query.executedAt', { date: toDateTime(data.date_run) })}
        </Text>
      </div>
    </div>
  );
};
