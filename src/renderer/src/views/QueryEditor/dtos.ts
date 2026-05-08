import type { ITableSort } from '@renderer/components/Table/dtos';
import type { ITableQuery } from '@renderer/utils/sql';

export interface IQueryResult {
  type: string;
  rows?: any[];
  columns?: string[];
  loading?: boolean;
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
}

export interface IPendingQueryExecution {
  query: string;
  openNewTab?: boolean;
  forceNewTab?: boolean;
  markErrors?: boolean;
}

export interface IExecuteQueryParams extends IPendingQueryExecution {
  variableValues?: Record<string, string>;
}

export type IDataMakeTabResult = IQueryResult & { title?: string };

export type IDataUpdateabResult = Partial<IDataMakeTabResult>;

export interface IQueryEditorProps {
  id_connection: string;
  id_script?: string;
}
