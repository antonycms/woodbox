import type { TranslateFn } from '@renderer/stores/I18n/types';
import type { ExplainAnalysis, ExplainOperation } from '@shared/types/databaseExplain';
import type { DatabaseRow } from '@shared/types/database';

const parseJsonValue = (value: unknown) => {
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const getRawPlanJson = (rows: DatabaseRow[]) => {
  if (rows.length === 1) {
    const values = Object.values(rows[0]).filter((value) => value !== undefined);

    if (values.length === 1) return JSON.stringify(parseJsonValue(values[0]), null, 2);
  }

  return JSON.stringify(rows.map((row) => parseJsonValue(row)), null, 2);
};

const operationLabel = (operation: ExplainOperation, t: TranslateFn) =>
  `${operation.usesDefaultLabel ? t('query.explainOperation') : ''}${operation.label}`;

export const presentExplainAnalysis = (analysis: ExplainAnalysis | undefined, t: TranslateFn) => ({
  totalTimeMs: analysis?.totalTimeMs,
  planningTimeMs: analysis?.planningTimeMs,
  bottlenecks: (analysis?.bottlenecks || []).map(({ usesDefaultLabel, ...item }) => ({ ...item, label: operationLabel({ ...item, usesDefaultLabel }, t) })),
  warnings: (analysis?.warnings || []).map((warning) => {
    if (warning.code === 'rows-mismatch') return t('query.explainRowsMismatch', { operation: operationLabel(warning.operation, t) });
    if (warning.code === 'sequential-scan') return t('query.explainSequentialScan', { operation: operationLabel(warning.operation, t) });
    const keys = { 'full-scan': 'query.explainFullScan', 'file-sort': 'query.explainFileSort', temporary: 'query.explainTemporary' } as const;
    return t(keys[warning.code]);
  }),
  riskLevel: analysis?.riskLevel || 'low',
});
