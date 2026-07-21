import React from 'react';
import { IQueryResult } from '../../dtos';
import styles from '../../styles.module.css';
import { Text } from '@renderer/components/Text';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { toDateTime } from '@renderer/utils/date';

interface ITabContentAlter {
  data: IQueryResult;
}

export const TabContentAlter = (props: ITabContentAlter) => {
  const { t } = useI18n();
  const { activeTheme } = useThemeContext();
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
