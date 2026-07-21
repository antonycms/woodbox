import React from 'react';
import IconMdiAlertCircle from '~icons/mdi/alert-circle';
import { Text } from '@renderer/components/Text';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import styles from '../../styles.module.css';
import { IQueryResult } from '../../dtos';
import { toDateTime } from '@renderer/utils/date';

interface ITabContentError {
  data: IQueryResult;
}

export const TabcontentError = (props: ITabContentError) => {
  const { data } = props;
  const { t } = useI18n();
  const {
    activeTheme: { __colors },
  } = useThemeContext();
  const style = {
    '--errorBorderColor': __colors.redDeep,
    '--errorAccentColor': __colors.red,
    '--errorBackgroundColor': __colors.darkLight,
    '--errorMessageBackgroundColor': __colors.darkLight,
  } as React.CSSProperties;

  return (
    <div className={styles.resultContainer}>
      <div className={styles.resultCard} style={style}>
        <div className={styles.resultHeader}>
          <IconMdiAlertCircle width={18} height={18} />

          <Text bold color={__colors.red}>
            {t('query.executionErrorTitle')}
          </Text>
        </div>

        <div className={styles.resultMessage}>
          <Text color={__colors.white}>{data.message || t('common.unknownErrorNoDot')}</Text>
        </div>

        <Text small color={__colors.gray}>
          {t('query.executedAt', { date: toDateTime(data.date_run) })}
        </Text>
      </div>
    </div>
  );
};
