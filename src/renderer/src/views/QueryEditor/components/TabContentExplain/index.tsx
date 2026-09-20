import React from 'react';
import { Bar } from '@renderer/components/Bar';
import { Button } from '@renderer/components/Button';
import Editor from '@renderer/components/Editor';
import { MultiplesBarLoading } from '@renderer/components/Loaders';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import { CancelIcon, ExportIcon } from '@renderer/styles/icons';
import { toDateTime } from '@renderer/utils/date';
import type { IQueryResult } from '../../dtos';
import styles from './styles.module.css';
import {
  analyzeExplain,
  compareExplain,
  getRawPlanJson,
  type ExplainAnalysis,
  type ExplainMetricComparison,
  type ExplainRow,
} from './utils';

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
  const [viewMode, setViewMode] = React.useState<'analysis' | 'json' | 'comparison'>('analysis');
  const [baseline, setBaseline] = React.useState<ExplainAnalysis>();
  const [now, setNow] = React.useState(Date.now());
  const { showToast } = useToast();

  const analysis = React.useMemo(() => analyzeExplain(data, t), [data, t]);
  const comparison = React.useMemo(
    () => (baseline ? compareExplain(analysis, baseline) : undefined),
    [analysis, baseline],
  );
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

  const formatDelta = (metric: ExplainMetricComparison) => {
    if (metric.delta === undefined) return '-';

    const sign = metric.delta > 0 ? '+' : '';
    const percentage =
      metric.percentage === undefined ? '' : ` (${sign}${metric.percentage.toFixed(1)}%)`;

    return `${sign}${formatMs(metric.delta)}${percentage}`;
  };

  const saveBaseline = React.useCallback(() => {
    setBaseline(analysis);
    setViewMode('comparison');
    showToast({
      type: 'success',
      title: baseline ? t('query.explainBaselineUpdated') : t('query.explainBaselineSaved'),
    });
  }, [analysis, baseline, showToast, t]);

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
        ) : viewMode === 'comparison' && comparison ? (
          <>
            <header className={styles.header}>
              <div>
                <h3>{t('query.explainComparisonTitle')}</h3>
                <p>{t('query.explainComparisonDescription')}</p>
              </div>
            </header>

            <section className={styles.metrics}>
              <article>
                <small>{t('query.explainTotalTime')}</small>
                <strong>{formatDelta(comparison.totalTime)}</strong>
                <span className={styles.metricHint}>{t('query.explainComparisonDelta')}</span>
              </article>
              <article>
                <small>{t('query.explainPlanningTime')}</small>
                <strong>{formatDelta(comparison.planningTime)}</strong>
                <span className={styles.metricHint}>{t('query.explainComparisonDelta')}</span>
              </article>
              <article>
                <small>{t('query.explainBaselineValue')}</small>
                <strong>{formatMs(comparison.totalTime.baseline)}</strong>
                <span className={styles.metricHint}>{t('query.explainComparisonBaseline')}</span>
              </article>
              <article>
                <small>{t('query.explainCurrentValue')}</small>
                <strong>{formatMs(comparison.totalTime.current)}</strong>
                <span className={styles.metricHint}>{t('query.explainComparisonCurrent')}</span>
              </article>
            </section>

            <section className={styles.section}>
              <h4>{t('query.explainBottlenecks')}</h4>
              <div className={styles.comparisonTableWrapper}>
                <table className={styles.comparisonTable}>
                  <thead>
                    <tr>
                      <th>{t('query.explainOperation')}</th>
                      <th>{t('query.explainBaselineValue')}</th>
                      <th>{t('query.explainCurrentValue')}</th>
                      <th>{t('query.explainComparisonDelta')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {comparison.bottlenecks.map((item) => (
                      <tr key={item.label}>
                        <th>{item.label}</th>
                        <td>{formatMs(item.time.baseline)}</td>
                        <td>{formatMs(item.time.current)}</td>
                        <td
                          className={
                            item.time.delta !== undefined && item.time.delta > 0
                              ? styles.worse
                              : styles.better
                          }
                        >
                          {formatDelta(item.time)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          </>
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

            {baseline && (
              <Button
                text
                title={t('query.explainViewComparison')}
                onClick={() => setViewMode('comparison')}
                color={activeTheme.queryEditor.bar.color}
              >
                {t('query.explainCompare')}
              </Button>
            )}

            <Button
              text
              title={baseline ? t('query.explainUpdateBaseline') : t('query.explainSaveBaseline')}
              onClick={saveBaseline}
              color={activeTheme.queryEditor.bar.color}
            >
              {baseline ? t('query.explainUpdateBaseline') : t('query.explainSaveBaseline')}
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
