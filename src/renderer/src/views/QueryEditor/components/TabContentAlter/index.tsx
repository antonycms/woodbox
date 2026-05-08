import React from 'react';
import { IQueryResult } from '../../dtos';
import styles from '../../styles.module.css';
import { Text } from '@renderer/components/Text';
import { useThemeContext } from '@renderer/contexts/Theme';
import { toDateTime } from '@renderer/utils/date';

interface ITabContentAlter {
  data: IQueryResult;
}

export const TabContentAlter = (props: ITabContentAlter) => {
  const { activeTheme } = useThemeContext();
  const { data } = props;

  return (
    <div className={styles.paddingContent}>
      <Text bold color={activeTheme.queryEditor.tab.color}>
        Alteração realizada com sucesso
      </Text>

      <Text color={activeTheme.queryEditor.tab.color}>{data.query}</Text>

      <Text color={activeTheme.queryEditor.tab.color}>
        Executado em {toDateTime(data.date_run)}
      </Text>
    </div>
  );
};
