import type { Dialect } from './connections';

export interface IConnectionDialectDescriptor {
  label: string;
  mode: 'network' | 'file' | 'react-native-bridge';
  defaultPort?: number;
  supportsSsl: boolean;
}

export interface IDatabaseTechnicalCapabilities {
  supports_schemas: boolean;
  supports_functions: boolean;
  supports_process_list: boolean;
}

export interface DatabaseStructureOptions {
  columnTypeSuggestions?: ColumnTypeSuggestionsResult;
  indexMethods: string[];
  defaultIndexMethod: string;
  supportsAutoIncrement: boolean;
  fallbackColumnTypes: string[];
}

export interface IDatabaseDialectInfo extends IConnectionDialectDescriptor, IDatabaseTechnicalCapabilities, DatabaseStructureOptions {
  id: Dialect;
}

export interface ColumnTypeSuggestionsResult {
  types: { name: string }[];
  commonTypes: string[];
  autoIncrementTypes: Record<string, boolean>;
}

export type DatabaseRow = Record<string, unknown>;

export interface PrepareInsertDmlRequest {
  policyId: Dialect;
  target: { schema?: string; table: string };
  rows: DatabaseRow[];
  columnOrder?: string[];
}

export type InitialWhere = string | InitialWhereValue;
export interface InitialWhereValue {
  column: string;
  value: unknown;
}
export type PrepareInitialWhereRequest = InitialWhereValue & {
  schema?: string; table: string; includeColumns?: boolean;
};
export interface PreparedInitialWhere {
  where: string;
  columns?: IColumnInfo[];
}
export type ReadInitialWhereRequest = PrepareInitialWhereRequest & {
  page?: number; limit?: number; orderBy?: IOrderBy[];
};
export interface ReadInitialWhereResult extends PreparedInitialWhere {
  data: DatabaseRow[];
  error?: import('./ipc').IpcError;
}

export type DatabaseObjectType = 'table' | 'view' | 'materialized_view';

export interface ITable {
  table_name: string;
  table_schema?: string;
  comment?: string;
  object_type?: DatabaseObjectType;
  supports_indexes?: boolean;
  supports_triggers?: boolean;
  supports_table_comments?: boolean;
  total_size?: number;
}

export interface IFunctionDb {
  function_name: string;
  function_schema?: string;
  function_identity_arguments?: string;
}

export type DatabaseObjectCommand =
  | { type: 'create-schema'; schema: string }
  | { type: 'rename-schema'; schema: string; newName: string }
  | { type: 'drop-schema'; schema: string; cascade: boolean }
  | { type: 'rename-table'; schema?: string; table: string; newName: string }
  | { type: 'drop-table'; schema?: string; table: string };

export interface IConnectionInfo extends IDatabaseTechnicalCapabilities, DatabaseStructureOptions {
  dialect: Dialect;
  tables: ITable[];
  functions: IFunctionDb[];
  schemas?: string[];
  supports_table_comments?: boolean;
}

export interface IColumnInfo {
  display_type?: string;
  auto_increment_eligible?: boolean;
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
  data: DatabaseRow[];
}

export interface IOrderBy {
  columnName: string;
  sortType: 'ASC' | 'DESC';
}

export type CanonicalTableFilterValue =
  | { kind: 'text'; value: string }
  | { kind: 'number'; value: string }
  | { kind: 'boolean'; value: boolean }
  | { kind: 'null' }
  | { kind: 'bigint'; value: string }
  | { kind: 'instant'; value: string }
  | { kind: 'bytes'; encoding: 'base64'; value: string };

export type TableFilterUnavailableReason =
  | 'invalid-value'
  | 'insufficient-precision'
  | 'unsupported-value'
  | 'invalid-filter';

type TableFilterTarget = { schema?: string; table: string };

export type IParamsGetTableData = TableFilterTarget & { where?: string } & {
  page: number;
  limit?: number;
  orderBy?: IOrderBy[];
};

export type IParamsGetTableRowsCount = TableFilterTarget & { where?: string };

export type ExportDataSource =
  | (TableFilterTarget & { where?: string } & {
      type: 'table';
      orderBy?: IOrderBy[];
    })
  | { type: 'query'; sql: string; orderBy?: IOrderBy[] };

export interface IOptionsRunSql {
  limit?: number;
  page?: number;
  orderBy?: IOrderBy[];
  queryExecutionId?: string;
  columnTypes?: { name: string; type?: string }[];
}

export interface QueryColumnSource {
  schema?: string;
  table: string;
  column: string;
}

export interface SerializedRunSqlColumn {
  name: string;
  type?: string;
  source?: QueryColumnSource;
  // Opaque origin supplied by the driver; resolved to names only when saving.
  source_ref?: string;
}

export interface IRunSqlResult {
  type: string;
  affected_rows?: number | null;
  auto_paginated?: boolean;
  execution_time_ms?: number;
  rows?: DatabaseRow[];
  columns?: string[];
  columns_info?: SerializedRunSqlColumn[];
  // Native origins are authoritative, but may still be opaque source_ref values.
  column_sources_resolved?: boolean;
  supports_row_management?: boolean;
  row_management_table?: Pick<QueryColumnSource, 'schema' | 'table'>;
}

export interface SerializedRunSqlResult extends IRunSqlResult {
  rows: DatabaseRow[];
  columns: string[];
}

export type ExportDataFormat = 'csv' | 'json' | 'jsonl' | 'xlsx' | 'clipboard';

export interface IExportProgress {
  exportId: string;
  connectionId: string;
  phase: 'preparing' | 'exporting' | 'finalizing';
  rows: number;
  totalRows?: number;
}

export interface IExportDataParams {
  exportId: string;
  source: ExportDataSource;
  columns: string[];
  format: ExportDataFormat;
  batchSize?: number;
  fileName?: string;
}

export interface IExportDataPreview {
  columns: string[];
  rows: DatabaseRow[];
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
  client_port?: string | number | null;
  application?: string;
  state?: string;
  wait?: string;
  duration_seconds?: string | number;
  query?: string;
}

export type DbCellValue = string | number | boolean | Date | null;

export interface IImportProgress {
  importId: string;
  connectionId: string;
  phase: 'preparing' | 'importing' | 'finalizing';
  rows: number;
  totalRows: number;
}

export interface IImportTableDataParams {
  importId: string;
  schema?: string;
  table: string;
  rows: Record<string, DbCellValue>[];
}

export interface IImportTableDataResult {
  canceled: boolean;
  insertedRows: number;
}
