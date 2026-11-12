import type { Dialect } from '@shared/types/connections';
import type { DatabaseRow, IRunSqlResult } from '@shared/types/database';
import type { ExplainAnalysis, ExplainBottleneck as Bottleneck, ExplainWarning } from '@shared/types/databaseExplain';
type ExplainRow = DatabaseRow;

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
  return undefined;
};

const getPostgresNodeLabel = (node: PostgresPlanNode) => {
  const nodeType = String(node['Node Type'] || '');
  const relation = node['Relation Name'] ? ` · ${String(node['Relation Name'])}` : '';
  return { label: `${nodeType}${relation}`, ...(!node['Node Type'] ? { usesDefaultLabel: true } : {}) };
};

const getPostgresBottlenecks = (
  node: PostgresPlanNode,
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
    ...getPostgresNodeLabel(node),
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

  node.Plans?.forEach((child) => getPostgresBottlenecks(child, items));

  return items;
};

const applySeverity = (item: Bottleneck): Bottleneck => {
  if ((item.timeMs ?? 0) >= 1000) return { ...item, severity: 'danger' };
  if ((item.timeMs ?? 0) >= 100) return { ...item, severity: 'warn' };

  return item;
};

const getRiskLevel = (
  bottlenecks: Bottleneck[],
  warnings: ExplainWarning[],
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

export const analyzeExplainResult = (dialect: Dialect, data: IRunSqlResult): ExplainAnalysis => {
  const rows = (data.rows || []) as ExplainRow[];
  const warnings: ExplainWarning[] = [];

  if (dialect === 'postgres') {
    const parsed = readPostgresJsonPlan(rows);
    const root = parsed?.Plan as PostgresPlanNode | undefined;

    if (root && parsed) {
      const bottlenecks = getPostgresBottlenecks(root)
        .map((item) => {
          const rowRatio =
            item.rows !== undefined && item.planRows ? item.rows / Math.max(item.planRows, 1) : 1;

          if (rowRatio >= 10) {
            warnings.push({ code: 'rows-mismatch', operation: { label: item.label, ...(item.usesDefaultLabel ? { usesDefaultLabel: true } : {}) } });
          }

          if (
            item.label.toLowerCase().includes('seq scan') &&
            (item.rows ?? item.planRows ?? 0) > 1000
          ) {
            warnings.push({ code: 'sequential-scan', operation: { label: item.label, ...(item.usesDefaultLabel ? { usesDefaultLabel: true } : {}) } });
          }

          return applySeverity(item);
        })
        .sort((a, b) => (b.timeMs ?? 0) - (a.timeMs ?? 0))
        .slice(0, 8);

      return {
        totalTimeMs: toNumber(parsed['Execution Time']),
        planningTimeMs: toNumber(parsed['Planning Time']),
        bottlenecks,
        warnings,
        riskLevel: getRiskLevel(bottlenecks, warnings),
      };
    }
  }

  const planText = getPlanText(rows);
  const lowerPlan = planText.toLowerCase();

  if (/\b(table scan|full scan|scan table|scan\s+\w+)/i.test(planText)) {
    warnings.push({ code: 'full-scan' });
  }

  if (lowerPlan.includes('filesort')) warnings.push({ code: 'file-sort' });
  if (lowerPlan.includes('temporary')) warnings.push({ code: 'temporary' });

  const bottlenecks = getTextBottlenecks(planText);

  return {
    totalTimeMs: data.execution_time_ms,
    bottlenecks,
    warnings,
    riskLevel: getRiskLevel(bottlenecks, warnings),
  };
};
