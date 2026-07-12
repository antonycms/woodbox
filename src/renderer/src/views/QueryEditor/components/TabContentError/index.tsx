import React from 'react';
import IconMdiAlertCircle from '~icons/mdi/alert-circle';
import { Text } from '@renderer/components/Text';
import { useThemeContext } from '@renderer/contexts/Theme';
import styles from '../../styles.module.css';
import { IQueryResult } from '../../dtos';
import { toDateTime } from '@renderer/utils/date';

interface ITabContentError {
  data: IQueryResult;
}

export const TabcontentError = (props: ITabContentError) => {
  const { data } = props;
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
            Erro ao executar a query
          </Text>
        </div>

        <div className={styles.resultMessage}>
          <Text color={__colors.white}>{data.message || 'Erro desconhecido'}</Text>
        </div>

        <Text small color={__colors.gray}>
          Executado em {toDateTime(data.date_run)}
        </Text>
      </div>
    </div>
  );
};
