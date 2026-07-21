import React from 'react';
import { Text } from '@renderer/components/Text';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import styles from '../../styles.module.css';
import { IQueryResult } from '../../dtos';
import { toDateTime } from '@renderer/utils/date';

interface ITabContentGeneric {
  data: IQueryResult;
}

export const TabContentGeneric = (props: ITabContentGeneric) => {
  const { t } = useI18n();
  const { activeTheme } = useThemeContext();
  const { data } = props;

  return (
    <div className={styles.paddingContent}>
      <Text bold color={activeTheme.queryEditor.tab.color}>
        {t('query.success')}
      </Text>

      <Text color={activeTheme.queryEditor.tab.color}>{data.query}</Text>

      <Text color={activeTheme.queryEditor.tab.color}>
        {t('query.executedAt', { date: toDateTime(data.date_run) })}
      </Text>
    </div>
  );
};
