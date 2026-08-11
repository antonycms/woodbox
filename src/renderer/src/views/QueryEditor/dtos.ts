import type { ITableSort } from '@renderer/components/Table/dtos';
import type { Dialect } from '@renderer/database/dialects';
import type { ITableQuery } from '@renderer/utils/sql';

export interface IQueryResult {
  type: string;
  rows?: any[];
  columns?: string[];
  columns_info?: IQueryResultColumn[];
  loading?: boolean;
  queryExecutionId?: string;
  message?: string;
  query: string;
  affected_rows?: number;
  date_run?: string;
  execution_time_ms?: number;
  page?: number;
  orderBy?: ITableSort[];
  auto_paginated?: boolean;
  tables_info?: ITableQuery[];
  variableValues?: Record<string, string>;
  capture?: IQueryCaptureState;
  explain?: IQueryExplainResult;
}

export interface IQueryResultColumn {
  name: string;
  type?: string;
}

export interface IPendingQueryExecution {
  query: string;
  editorOffset?: number;
  openNewTab?: boolean;
  forceNewTab?: boolean;
  markErrors?: boolean;
  mode?: 'run' | 'explain';
}

export interface IExecuteQueryParams extends IPendingQueryExecution {
  variableValues?: Record<string, string>;
}

export type IDataMakeTabResult = IQueryResult & { title?: string };

export interface IQueryCapturedRow {
  captured_at: string;
  row: any;
}

export interface IQueryCaptureState {
  active: boolean;
  started_at?: string;
  stopped_at?: string;
  rows: IQueryCapturedRow[];
  rowHashes: string[];
}

export interface IQueryExplainResult {
  dialect: Dialect;
  originalQuery: string;
}

export type IDataUpdateabResult = Partial<IDataMakeTabResult> & { captureRows?: boolean };

export interface IQueryEditorProps {
  id_connection: string;
  id_script?: string;
}
