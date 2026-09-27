import type { ITableSort } from '@renderer/components/Table/dtos';
import type { Dialect } from '@shared/types/connections';
import type { DatabaseRow, IRunSqlResult } from '@shared/types/database';
import type { ITableQuery } from '@renderer/utils/sql';

export interface IQueryResult extends IRunSqlResult {
  loading?: boolean;
  queryExecutionId?: string;
  message?: string;
  query: string;
  date_run?: string;
  page?: number;
  orderBy?: ITableSort[];
  tables_info?: ITableQuery[];
  variableValues?: Record<string, string>;
  capture?: IQueryCaptureState;
  explain?: IQueryExplainResult;
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
  row: DatabaseRow;
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
  isActiveTab?: boolean;
  id_connection: string;
  id_script?: string;
}
