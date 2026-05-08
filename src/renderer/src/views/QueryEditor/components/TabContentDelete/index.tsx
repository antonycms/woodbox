import React from 'react';
import styles from '../../styles.module.css';
import { Text } from '@renderer/components/Text';
import { useThemeContext } from '@renderer/contexts/Theme';
import { toDateTime } from '@renderer/utils/date';
import { IQueryResult } from '../../dtos';

interface ITabContentDelete {
  data: IQueryResult;
}

export const TabContentDelete = (props: ITabContentDelete) => {
  const { data } = props;

  const { activeTheme } = useThemeContext();

  return (
    <div className={styles.paddingContent}>
      <Text bold color={activeTheme.queryEditor.tab.color}>
        Remoção executada com sucesso
      </Text>

      <Text color={activeTheme.queryEditor.tab.color}>{data.query}</Text>

      <Text color={activeTheme.queryEditor.tab.color}>
        Total de linhas afetadas: {data.affected_rows}
      </Text>

      <Text color={activeTheme.queryEditor.tab.color}>
        Executado em {toDateTime(data.date_run)}
      </Text>
    </div>
  );
};
