import React from 'react';
import IconMdiAlertCircle from '~icons/mdi/alert-circle';
import { Text } from '@renderer/components/Text';
import styles from '../../styles.module.css';
import { IQueryResult } from '../../dtos';
import { toDateTime } from '@renderer/utils/date';

interface ITabContentError {
  data: IQueryResult;
}

export const TabcontentError = (props: ITabContentError) => {
  const { data } = props;

  return (
    <div className={styles.resultContainer}>
      <div className={styles.resultCard}>
        <div className={styles.resultHeader}>
          <IconMdiAlertCircle width={18} height={18} />

          <Text bold color="#ffb4b4">
            Erro ao executar a query
          </Text>
        </div>

        <div className={styles.resultMessage}>
          <Text color="#ffe1e1">{data.message || 'Erro desconhecido'}</Text>
        </div>

        <Text small color="#c9a0a0">
          Executado em {toDateTime(data.date_run)}
        </Text>
      </div>
    </div>
  );
};
