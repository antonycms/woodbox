import React from 'react';
import { Button } from '@renderer/components/Button';
import { Text } from '@renderer/components/Text';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { useToastStore } from '@renderer/stores/Toast';
import { CopyIcon } from '@renderer/styles/icons';
import { getErrorMessage } from '@shared/utils/error';
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
  const showToast = useToastStore((state) => state.showToast);
  const executionResults = data.executionResults ?? [];
  const results = executionResults.map((result, index) => ({ result, index }))
    .filter(({ result }) => result.columns?.length);

  const copyResults = async () => {
    try {
      const payload = executionResults.map(({ query, type, columns, rows, affected_rows }) => ({
        query,
        type,
        columns: columns ?? [],
        rows: rows ?? [],
        affected_rows,
      }));
      await navigator.clipboard.writeText(JSON.stringify(payload, null, 2));
      showToast({ type: 'success', title: t('query.executionResultsCopied') });
    } catch (error) {
      const title = t('query.executionResultsCopyFailed');
      showToast({ type: 'error', title, description: getErrorMessage(error, title) });
    }
  };

  return (
    <div className={styles.container} style={{ color: theme.color, '--execution-border': theme.borderColor } as React.CSSProperties}>
      <header className={styles.executionInfo}>
        <Text bold userSelect={false} color={theme.color}>
          {t(data.loading ? 'common.loading' : 'query.success')}
        </Text>
        {!data.loading && data.date_run && (
          <Text userSelect={false} color={theme.color}>
            {t('query.executedAt', { date: toDateTime(data.date_run) })}
          </Text>
        )}
      </header>
      {executionResults.length > 0 && (
        <section className={styles.results}>
          {results.length > 0 ? (
            <details className={styles.resultsDisclosure} open>
              <summary className={styles.resultsTitle}>{t('query.executionResults')}</summary>
              <div className={styles.resultList}>
                {results.map(({ result, index }) => (
                  <section key={index} className={styles.result}>
                    <ExecutionResult data={result} />
                  </section>
                ))}
              </div>
            </details>
          ) : (
            <div className={styles.resultsTitle}>{t('query.executionResults')}</div>
          )}
          <div className={styles.resultsActions}>
            <Button text smallIcon color={theme.color} title={t('query.copyExecutionResults')} onClick={copyResults}>
              <CopyIcon size={15} />
            </Button>
          </div>
        </section>
      )}
      <details className={styles.executionSql}>
        <summary>{t('query.executionSql')}</summary>
        <pre className={queryEditorStyles.queryText}>{data.query}</pre>
      </details>
    </div>
  );
};
