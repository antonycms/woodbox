import React from 'react';
import { IQueryResult } from '../../dtos';
import styles from '../../styles.module.css';
import { Text } from '@renderer/components/Text';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { toDateTime } from '@renderer/utils/date';

interface ITabContentAlter {
  data: IQueryResult;
}

export const TabContentAlter = (props: ITabContentAlter) => {
  const t = useI18nStore((state) => state.t);
  const activeTheme = useThemeStore((state) => state.activeTheme);
  const { data } = props;

  return (
    <div className={styles.paddingContent}>
      <Text bold color={activeTheme.queryEditor.tab.color}>
        {t('query.alterSuccess')}
      </Text>

      <Text color={activeTheme.queryEditor.tab.color}>{data.query}</Text>

      <Text color={activeTheme.queryEditor.tab.color}>
        {t('query.executedAt', { date: toDateTime(data.date_run) })}
      </Text>
    </div>
  );
};
