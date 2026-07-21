import React from 'react';
import styles from '../../styles.module.css';
import { Text } from '@renderer/components/Text';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { toDateTime } from '@renderer/utils/date';
import { IQueryResult } from '../../dtos';

interface ITabContentDelete {
  data: IQueryResult;
}

export const TabContentDelete = (props: ITabContentDelete) => {
  const { data } = props;
  const { t } = useI18n();

  const { activeTheme } = useThemeContext();

  return (
    <div className={styles.paddingContent}>
      <Text bold color={activeTheme.queryEditor.tab.color}>
        {t('query.deleteSuccess')}
      </Text>

      <Text color={activeTheme.queryEditor.tab.color}>{data.query}</Text>

      <Text color={activeTheme.queryEditor.tab.color}>
        {t('query.affectedRows', { count: data.affected_rows || 0 })}
      </Text>

      <Text color={activeTheme.queryEditor.tab.color}>
        {t('query.executedAt', { date: toDateTime(data.date_run) })}
      </Text>
    </div>
  );
};
