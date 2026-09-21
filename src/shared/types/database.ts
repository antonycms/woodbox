export type DatabaseObjectType = 'table' | 'view' | 'materialized_view';

export interface ITable {
  table_name: string;
  table_schema?: string;
  object_type?: DatabaseObjectType;
  supports_indexes?: boolean;
  supports_triggers?: boolean;
  total_size?: number;
}

export interface IFunctionDb {
  function_name: string;
  function_schema?: string;
  function_identity_arguments?: string;
}

export interface IConnectionInfo {
  tables: ITable[];
  functions: IFunctionDb[];
  schemas?: string[];
}

export interface IColumnInfo {
  column_name: string;
  data_type: string;
  is_nullable: boolean;
  is_nullable_label?: string;
  column_default?: string;
  extra?: string;
  is_auto_increment?: boolean;
  is_auto_increment_label?: string;
  description?: string;
  udt_name?: string;
  character_maximum_length?: number;
  numeric_precision?: number;
  numeric_scale?: number;
  datetime_precision?: number;
}

export interface IColumnReferenceInfo {
  constraint_name: string;
  table_schema: string;
  table_name: string;
  column_name: string;
  reference_table_schema: string;
  reference_table_name: string;
  reference_column_name: string;
  constraint_definition?: string;
  constraint_order?: number;
  comment?: string;
  remove_rule?: string;
  update_rule?: string;
}

export type ConstraintType = 'primary_key' | 'unique_key' | 'check' | 'exclusion';

export interface IColumnRestrictionsInfo {
  constraint_name: string;
  constraint_type: ConstraintType;
  constraint_definition?: string;
  column_names?: string[];
  expression?: string;
  comment?: string;
}

export type IndexColumnOrder = 'ASC' | 'DESC';

export interface IIndexInfo {
  index_name: string;
  index_method: string;
  is_unique: boolean;
  is_primary: boolean;
  is_valid: boolean;
  column_names?: string[];
  column_orders?: IndexColumnOrder[];
  column_names_display?: string;
  expression?: string;
  predicate?: string;
  index_size_bytes?: number | string | null;
  index_size?: string;
  index_definition?: string;
}

export interface ITriggerInfo {
  trigger_name: string;
  timing: string;
  event: string;
  orientation: string;
  function_name: string;
  status: string;
  trigger_definition?: string;
}

export interface IDataTable {
  data: any[];
}

export interface IOrderBy {
  columnName: string;
  sortType: 'ASC' | 'DESC';
}

export interface IParamsGetTableData {
  table: string;
  schema?: string;
  page: number;
  limit?: number;
  where?: string;
  orderBy?: IOrderBy[];
}

export interface IOptionsRunSql {
  limit?: number;
  page?: number;
  orderBy?: IOrderBy[];
  queryExecutionId?: string;
}

export interface SerializedRunSqlColumn {
  name: string;
  type?: string;
}

export interface IRunSqlResult {
  type: string;
  affected_rows?: number;
  auto_paginated?: boolean;
  execution_time_ms?: number;
  rows?: any[];
  columns?: string[];
  columns_info?: SerializedRunSqlColumn[];
}

export interface SerializedRunSqlResult extends IRunSqlResult {
  rows: any[];
  columns: string[];
}

export type ExportDataFormat = 'csv' | 'json' | 'jsonl' | 'xlsx';

export type ExportDataSource =
  | { type: 'table'; schema?: string; table: string; where?: string; orderBy?: IOrderBy[] }
  | { type: 'query'; sql: string; orderBy?: IOrderBy[] };

export interface IExportDataParams {
  source: ExportDataSource;
  columns: string[];
  format: ExportDataFormat;
  batchSize?: number;
  fileName?: string;
}

export interface IExportDataPreview {
  columns: string[];
  rows: any[];
}

export interface IExportDataResult {
  canceled: boolean;
  filePath?: string;
  rows: number;
}

export interface IServerOutputMessage {
  id: string;
  connectionId: string;
  date: string;
  severity?: string;
  message: string;
  detail?: string;
  hint?: string;
  where?: string;
}

export interface IDatabaseProcess {
  pid: string | number;
  username?: string;
  database?: string;
  client?: string;
  application?: string;
  state?: string;
  wait?: string;
  duration_seconds?: string | number;
  query?: string;
}

export type DbCellValue = string | number | boolean | Date | null;

export interface IImportTableDataParams {
  schema?: string;
  table: string;
  rows: Record<string, DbCellValue>[];
}

export interface IImportTableDataResult {
  insertedRows: number;
}
