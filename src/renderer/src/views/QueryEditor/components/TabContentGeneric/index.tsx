import React from 'react';
import { Text } from '@renderer/components/Text';
import { useThemeContext } from '@renderer/contexts/Theme';
import styles from '../../styles.module.css';
import { IQueryResult } from '../../dtos';
import { toDateTime } from '@renderer/utils/date';

interface ITabContentGeneric {
  data: IQueryResult;
}

export const TabContentGeneric = (props: ITabContentGeneric) => {
  const { activeTheme } = useThemeContext();
  const { data } = props;

  return (
    <div className={styles.paddingContent}>
      <Text bold color={activeTheme.queryEditor.tab.color}>
        Query executada com sucesso
      </Text>

      <Text color={activeTheme.queryEditor.tab.color}>{data.query}</Text>

      <Text color={activeTheme.queryEditor.tab.color}>
        Executado em {toDateTime(data.date_run)}
      </Text>
    </div>
  );
};
