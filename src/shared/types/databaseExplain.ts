import type { IRunSqlResult } from './database';

export interface ExplainOperation {
  label: string;
  usesDefaultLabel?: boolean;
}
export interface ExplainBottleneck extends ExplainOperation {
  detail?: string;
  timeMs?: number;
  rows?: number;
  planRows?: number;
  loops?: number;
  cost?: string;
  severity: 'ok' | 'warn' | 'danger';
}
export type ExplainWarning =
  | { code: 'rows-mismatch' | 'sequential-scan'; operation: ExplainOperation }
  | { code: 'full-scan' | 'file-sort' | 'temporary' };
export interface ExplainAnalysis {
  totalTimeMs?: number;
  planningTimeMs?: number;
  bottlenecks: ExplainBottleneck[];
  warnings: ExplainWarning[];
  riskLevel: 'low' | 'medium' | 'high';
}
export interface IRunExplainResult extends IRunSqlResult {
  explainAnalysis: ExplainAnalysis;
}
