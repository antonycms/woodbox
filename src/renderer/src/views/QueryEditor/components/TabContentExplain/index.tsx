import React from 'react';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import Editor from '@renderer/components/Editor';
import { MultiplesBarLoading } from '@renderer/components/Loaders';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { CancelIcon, ExportIcon } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import type { IQueryResult } from '../../dtos';
import styles from './styles.module.css';
import { analyzeExplain, getRawPlanJson, type ExplainRow } from './utils';

import IconMdiCodeJson from '~icons/mdi/code-json';
import IconMdiTable from '~icons/mdi/table';

interface ITabContentExplainProps {
  data: IQueryResult;
  onCancelQuery(): void;
  cancelingQuery?: boolean;
}

export const TabContentExplain = ({
  data,
  onCancelQuery,
  cancelingQuery,
}: ITabContentExplainProps) => {
  const { t, language } = useI18n();
  const { activeTheme } = useThemeContext();
  const [viewMode, setViewMode] = React.useState<'analysis' | 'json'>('analysis');
  const [now, setNow] = React.useState(Date.now());

  const analysis = React.useMemo(() => analyzeExplain(data, t), [data, t]);
  const rawPlanJson = React.useMemo(
    () => getRawPlanJson((data.rows || []) as ExplainRow[]),
    [data.rows],
  );

  const formatMs = (value?: number) => {
    if (value === undefined || Number.isNaN(value)) return t('query.explainNoTiming');

    return value < 1000 ? `${value.toFixed(2)}ms` : `${(value / 1000).toFixed(2)}s`;
  };

  const formatNumber = (value?: number) => {
    if (value === undefined || Number.isNaN(value)) return '-';

    return value.toLocaleString(language);
  };

  const executionTimeMs = React.useMemo(() => {
    if (data.loading && data.date_run) {
      const startedAt = new Date(data.date_run).getTime();

      if (!Number.isNaN(startedAt)) return Math.max(0, now - startedAt);
    }

    return data.execution_time_ms;
  }, [data.loading, data.date_run, data.execution_time_ms, now]);

  const mainBottleneck = analysis.bottlenecks[0];
  const riskLabelByLevel = {
    low: t('query.explainRiskLow'),
    medium: t('query.explainRiskMedium'),
    high: t('query.explainRiskHigh'),
  };
  const riskClassByLevel = {
    low: styles.riskLow,
    medium: styles.riskMedium,
    high: styles.riskHigh,
  };

  const exportJson = React.useCallback(() => {
    const fileDate = (data.date_run || new Date().toISOString()).replace(/[:.]/g, '-');
    const blob = new Blob([rawPlanJson], { type: 'application/json;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `woodbox-explain-${fileDate}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [data.date_run, rawPlanJson]);

  React.useEffect(() => {
    if (!data.loading) return;

    setNow(Date.now());

    const interval = setInterval(() => setNow(Date.now()), 100);

    return () => clearInterval(interval);
  }, [data.loading, data.date_run, data.queryExecutionId]);

  return (
    <div
      className={styles.container}
      style={
        {
          '--explain-color': activeTheme.queryEditor.tab.color,
          '--explain-muted-color': activeTheme.queryEditor.explain.mutedColor,
          '--explain-border-color': activeTheme.queryEditor.tab.borderColor,
          '--explain-surface-color': activeTheme.queryEditor.explain.surfaceColor,
          '--explain-accent-color': activeTheme.queryEditor.tab.ascentColor,
          '--explain-warn-color': activeTheme.queryEditor.explain.warnColor,
          '--explain-danger-color': activeTheme.queryEditor.explain.dangerColor,
        } as React.CSSProperties
      }
    >
      <div className={data.loading ? styles.loadingContent : styles.content}>
        {data.loading ? (
          <div className={styles.loading}>
            <MultiplesBarLoading />
          </div>
        ) : viewMode === 'json' ? (
          <div className={styles.editorWrapper}>
            <Editor language="json" readonly hidePreview value={rawPlanJson} />
          </div>
        ) : (
          <>
            <header className={styles.header}>
              <div>
                <h3>{t('query.explainTitle')}</h3>
                <p>{t('query.explainDescription')}</p>
              </div>
            </header>

            <section className={styles.metrics}>
              <article>
                <small>{t('query.explainTotalTime')}</small>
                <strong>{formatMs(analysis.totalTimeMs)}</strong>
              </article>
              <article>
                <small>{t('query.explainPlanningTime')}</small>
                <strong>{formatMs(analysis.planningTimeMs)}</strong>
              </article>
              <article>
                <small>{t('query.explainMainBottleneck')}</small>
                <strong>{mainBottleneck?.label || '-'}</strong>
              </article>
              <article className={riskClassByLevel[analysis.riskLevel]}>
                <small>{t('query.explainRisk')}</small>
                <strong>{riskLabelByLevel[analysis.riskLevel]}</strong>
              </article>
            </section>

            <section className={styles.section}>
              <h4>{t('query.explainWarnings')}</h4>
              <div className={styles.warnings}>
                {analysis.warnings.length ? (
                  [...new Set(analysis.warnings)].map((warning) => (
                    <span key={warning}>{warning}</span>
                  ))
                ) : (
                  <span className={styles.okWarning}>{t('query.explainNoWarnings')}</span>
                )}
              </div>
            </section>

            <section className={styles.section}>
              <h4>{t('query.explainBottlenecks')}</h4>
              <div className={styles.bottlenecks}>
                {analysis.bottlenecks.map((item, index) => (
                  <article className={styles[item.severity]} key={`${item.label}_${index}`}>
                    <div>
                      <strong>{item.label}</strong>
                      {!!item.detail && <p>{item.detail}</p>}
                    </div>
                    <dl>
                      <div>
                        <dt>{t('query.explainTime')}</dt>
                        <dd>{formatMs(item.timeMs)}</dd>
                      </div>
                      <div>
                        <dt>{t('query.explainRows')}</dt>
                        <dd>{formatNumber(item.rows)}</dd>
                      </div>
                      <div>
                        <dt>{t('query.explainLoops')}</dt>
                        <dd>{formatNumber(item.loops)}</dd>
                      </div>
                      <div>
                        <dt>{t('query.explainCost')}</dt>
                        <dd>{item.cost || '-'}</dd>
                      </div>
                    </dl>
                  </article>
                ))}
              </div>
            </section>
          </>
        )}
      </div>

      <Bar
        backgroundColor={activeTheme.queryEditor.bar.backgroundColor}
        borderColor={activeTheme.queryEditor.bar.borderColor}
      >
        {!!data.loading && (
          <Button
            text
            smallIcon
            title={t('common.cancelQuery')}
            onClick={onCancelQuery}
            loading={cancelingQuery}
            color={activeTheme.queryEditor.bar.color}
          >
            <CancelIcon size={16} />
          </Button>
        )}

        {!data.loading && (
          <>
            <Button
              text
              smallIcon
              title={
                viewMode === 'analysis' ? t('tooltip.viewJson') : t('query.explainViewAnalysis')
              }
              onClick={() =>
                setViewMode((prevState) => (prevState === 'analysis' ? 'json' : 'analysis'))
              }
              color={activeTheme.queryEditor.bar.color}
            >
              {viewMode === 'analysis' ? (
                <IconMdiCodeJson width={16} />
              ) : (
                <IconMdiTable width={16} />
              )}
            </Button>

            <Button
              text
              smallIcon
              title={t('query.explainExportJson')}
              onClick={exportJson}
              color={activeTheme.queryEditor.bar.color}
            >
              <ExportIcon size={16} />
            </Button>
          </>
        )}

        <Spacer />

        <Text
          title={
            data.loading ? t('tooltip.currentQueryExecutionTime') : t('tooltip.queryExecutionTime')
          }
          userSelect={false}
          color={activeTheme.queryEditor.bar.color}
        >
          {data.loading
            ? t('query.runningFor', { time: formatMs(executionTimeMs) })
            : formatMs(executionTimeMs)}
        </Text>

        <Text
          title={t('common.lastUpdatedAt')}
          userSelect={false}
          color={activeTheme.queryEditor.bar.color}
        >
          {t('common.updatedAt', { date: toDateTime(data.date_run) })}
        </Text>
      </Bar>
    </div>
  );
};
