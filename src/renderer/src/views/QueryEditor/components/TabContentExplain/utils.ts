import type { II18nContext } from '@renderer/contexts/I18n';
import type { IQueryResult } from '../../dtos';

export type ExplainRow = Record<string, unknown>;

type Bottleneck = {
  label: string;
  detail?: string;
  timeMs?: number;
  rows?: number;
  planRows?: number;
  loops?: number;
  cost?: string;
  severity: 'ok' | 'warn' | 'danger';
};

type ExplainAnalysis = {
  planText: string;
  totalTimeMs?: number;
  planningTimeMs?: number;
  bottlenecks: Bottleneck[];
  warnings: string[];
  riskLevel: 'low' | 'medium' | 'high';
};

type PostgresPlanNode = Record<string, unknown> & {
  Plans?: PostgresPlanNode[];
};

const toNumber = (value: unknown) => {
  const number = Number(value);

  return Number.isFinite(number) ? number : undefined;
};

const getRowValue = (row: ExplainRow, names: string[]) => {
  const lowerNames = names.map((name) => name.toLowerCase());
  const key = Object.keys(row).find((rowKey) => lowerNames.includes(rowKey.toLowerCase()));

  return key ? row[key] : undefined;
};

const stringifyValue = (value: unknown) => {
  if (value === null || value === undefined) return '';
  if (typeof value === 'string') return value;

  try {
    return JSON.stringify(value, null, 2);
  } catch {
    return String(value);
  }
};

const parseJsonValue = (value: unknown) => {
  if (typeof value !== 'string') return value;

  try {
    return JSON.parse(value);
  } catch {
    return value;
  }
};

export const getRawPlanJson = (rows: ExplainRow[]) => {
  if (rows.length === 1) {
    const values = Object.values(rows[0]).filter((value) => value !== undefined);

    if (values.length === 1) return JSON.stringify(parseJsonValue(values[0]), null, 2);
  }

  return JSON.stringify(rows.map((row) => parseJsonValue(row)), null, 2);
};

const getPlanText = (rows: ExplainRow[]) => {
  return rows
    .map((row) => {
      const value =
        getRowValue(row, ['QUERY PLAN', 'EXPLAIN', 'detail']) ??
        Object.values(row).find((item) => item !== undefined);

      return stringifyValue(value);
    })
    .filter(Boolean)
    .join('\n');
};

const readPostgresJsonPlan = (rows: ExplainRow[]) => {
  const value = rows
    .map((row) => getRowValue(row, ['QUERY PLAN']))
    .find((item) => item !== undefined);

  if (Array.isArray(value)) return value[0] as Record<string, unknown> | undefined;

  if (typeof value === 'string') {
    try {
      const parsed = JSON.parse(value);
      return Array.isArray(parsed) ? (parsed[0] as Record<string, unknown>) : undefined;
    } catch {
      return undefined;
    }
  }
};

const getPostgresNodeLabel = (node: PostgresPlanNode, fallbackLabel: string) => {
  const nodeType = String(node['Node Type'] || fallbackLabel);
  const relation = node['Relation Name'] ? ` · ${String(node['Relation Name'])}` : '';

  return `${nodeType}${relation}`;
};

const getPostgresBottlenecks = (
  node: PostgresPlanNode,
  fallbackLabel: string,
  items: Bottleneck[] = [],
) => {
  const loops = toNumber(node['Actual Loops']) ?? 1;
  const timeMs = toNumber(node['Actual Total Time']);
  const startupCost = toNumber(node['Startup Cost']);
  const totalCost = toNumber(node['Total Cost']);
  const cost =
    startupCost !== undefined && totalCost !== undefined
      ? `${startupCost}..${totalCost}`
      : undefined;

  items.push({
    label: getPostgresNodeLabel(node, fallbackLabel),
    detail: [node['Filter'], node['Index Cond'], node['Join Filter']]
      .filter(Boolean)
      .map(String)
      .join(' | '),
    timeMs: timeMs !== undefined ? timeMs * loops : undefined,
    rows: toNumber(node['Actual Rows']),
    planRows: toNumber(node['Plan Rows']),
    loops,
    cost,
    severity: 'ok',
  });

  node.Plans?.forEach((child) => getPostgresBottlenecks(child, fallbackLabel, items));

  return items;
};

const applySeverity = (item: Bottleneck): Bottleneck => {
  if ((item.timeMs ?? 0) >= 1000) return { ...item, severity: 'danger' };
  if ((item.timeMs ?? 0) >= 100) return { ...item, severity: 'warn' };

  return item;
};

const getRiskLevel = (
  bottlenecks: Bottleneck[],
  warnings: string[],
): ExplainAnalysis['riskLevel'] => {
  if (bottlenecks.some((item) => item.severity === 'danger')) return 'high';
  if (warnings.length || bottlenecks.some((item) => item.severity === 'warn')) return 'medium';

  return 'low';
};

const getTextBottlenecks = (planText: string): Bottleneck[] => {
  return planText
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const timeMatch = line.match(/actual time=(\d+(?:\.\d+)?)\.\.(\d+(?:\.\d+)?)/i);
      const rowsMatch = line.match(/\brows=(\d+)/i);
      const loopsMatch = line.match(/\bloops=(\d+)/i);
      const timeMs = toNumber(timeMatch?.[2]);

      return applySeverity({
        label: line.replace(/^->\s*/, '').split('(')[0].trim() || line,
        detail: line,
        timeMs,
        rows: toNumber(rowsMatch?.[1]),
        loops: toNumber(loopsMatch?.[1]),
        severity: 'ok',
      });
    })
    .sort((a, b) => (b.timeMs ?? 0) - (a.timeMs ?? 0))
    .slice(0, 8);
};

export const analyzeExplain = (
  data: IQueryResult,
  t: II18nContext['t'],
): ExplainAnalysis => {
  const rows = (data.rows || []) as ExplainRow[];
  const planText = getPlanText(rows);
  const warnings: string[] = [];

  if (data.explain?.dialect === 'postgres') {
    const parsed = readPostgresJsonPlan(rows);
    const root = parsed?.Plan as PostgresPlanNode | undefined;

    if (root) {
      const bottlenecks = getPostgresBottlenecks(root, t('query.explainOperation'))
        .map((item) => {
          const rowRatio =
            item.rows !== undefined && item.planRows ? item.rows / Math.max(item.planRows, 1) : 1;

          if (rowRatio >= 10) {
            warnings.push(t('query.explainRowsMismatch', { operation: item.label }));
          }

          if (
            item.label.toLowerCase().includes('seq scan') &&
            (item.rows ?? item.planRows ?? 0) > 1000
          ) {
            warnings.push(t('query.explainSequentialScan', { operation: item.label }));
          }

          return applySeverity(item);
        })
        .sort((a, b) => (b.timeMs ?? 0) - (a.timeMs ?? 0))
        .slice(0, 8);

      return {
        planText,
        totalTimeMs: toNumber(parsed['Execution Time']),
        planningTimeMs: toNumber(parsed['Planning Time']),
        bottlenecks,
        warnings,
        riskLevel: getRiskLevel(bottlenecks, warnings),
      };
    }
  }

  const lowerPlan = planText.toLowerCase();

  if (/\b(table scan|full scan|scan table|scan\s+\w+)/i.test(planText)) {
    warnings.push(t('query.explainFullScan'));
  }

  if (lowerPlan.includes('filesort')) warnings.push(t('query.explainFileSort'));
  if (lowerPlan.includes('temporary')) warnings.push(t('query.explainTemporary'));

  const bottlenecks = getTextBottlenecks(planText);

  return {
    planText,
    totalTimeMs: data.execution_time_ms,
    bottlenecks,
    warnings,
    riskLevel: getRiskLevel(bottlenecks, warnings),
  };
};
