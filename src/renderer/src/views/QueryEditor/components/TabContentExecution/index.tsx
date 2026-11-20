import React from 'react';
import { Text } from '@renderer/components/Text';
import { Divider } from '@renderer/components/Divider';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { toDateTime } from '@renderer/utils/date';
import type { IQueryResult } from '../../dtos';
import { ExecutionResult } from './components/ExecutionResult';
import queryEditorStyles from '../../styles.module.css';
import styles from './styles.module.css';

interface TabContentExecutionProps {
  data: IQueryResult;
}

export const TabContentExecution = ({ data }: TabContentExecutionProps) => {
  const t = useI18nStore((state) => state.t);
  const theme = useThemeStore((state) => state.activeTheme.queryEditor.tab);
  const results = (data.executionResults ?? []).map((result, index) => ({ result, index }))
    .filter(({ result }) => result.columns?.length);

  return (
    <div className={styles.container} style={{ color: theme.color }}>
      <header className={styles.executionInfo}>
        <Text bold userSelect={false} color={theme.color}>
          {t(data.loading ? 'common.loading' : 'query.success')}
        </Text>
        {!data.loading && data.date_run && (
          <Text userSelect={false} color={theme.color}>
            {t('query.executedAt', { date: toDateTime(data.date_run) })}
          </Text>
        )}
        <pre className={queryEditorStyles.queryText}>{data.query}</pre>
      </header>
      {results.length > 0 && (
        <details className={styles.results}>
          <summary className={styles.resultsTitle}>
            <Text className={styles.titleText} bold userSelect={false} color={theme.color}>{t('query.executionResults')}</Text>
          </summary>
          {results.map(({ result, index }, position) => (
            <section key={index} className={styles.result}>
              {position > 0 && <Divider color={theme.borderColor} />}
              <ExecutionResult data={result} />
            </section>
          ))}
        </details>
      )}
    </div>
  );
};
