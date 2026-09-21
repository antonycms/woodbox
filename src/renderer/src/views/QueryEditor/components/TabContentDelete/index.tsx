import React from 'react';
import styles from '../../styles.module.css';
import { Text } from '@renderer/components/Text';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { toDateTime } from '@renderer/utils/date';
import { IQueryResult } from '../../dtos';

interface ITabContentDelete {
  data: IQueryResult;
}

export const TabContentDelete = (props: ITabContentDelete) => {
  const { data } = props;
  const t = useI18nStore((state) => state.t);

  const activeTheme = useThemeStore((state) => state.activeTheme);

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
