export interface IExportProgress {
  exportId: string;
  connectionId: string;
  rows: number;
}

export interface ITableRowChange {
  rowKey: string;
  original: Record<string, unknown>;
  changes?: Record<string, unknown>;
}

export interface IApplyTableChangesParams {
  schema?: string;
  table: string;
  keyColumns: string[];
  inserts: Record<string, unknown>[];
  updates: ITableRowChange[];
  deletes: ITableRowChange[];
}

export interface ITableDataConflict extends ITableRowChange {
  current?: Record<string, unknown>;
  reason: 'changed' | 'missing' | 'ambiguous';
}

export interface IApplyTableChangesResult {
  conflicts: ITableDataConflict[];
}
