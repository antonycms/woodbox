import { createContext } from 'react';
import type { Dialect } from '@renderer/database/dialects';

export interface IScript {
  id: string;
  name: string;
  id_connection: string;
  content?: string; // Not loaded in listing — fetched on demand when opening a script
  created_at: string;
  updated_at: string;
}

export interface ISnippet {
  id: string;
  name: string;
  scope?: string;
  prefix: string | string[];
  body: string | string[];
  description?: string;
  created_at: string;
  updated_at: string;
}

export type AIProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'openrouter'
  | 'openai-compatible'
  | 'codex-chatgpt';

export interface IAIProvider {
  id: string;
  name: string;
  type: AIProviderType;
  models: string[];
  baseURL?: string;
  hasApiKey: boolean;
  created_at: string;
  updated_at: string;
}

export interface IAIProviderCreate {
  id?: string;
  name: string;
  type: AIProviderType;
  models: string[];
  apiKey?: string;
  baseURL?: string;
}

export interface IAIChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

export interface IAIQueryApproval {
  id: string;
  connectionId: string;
  connectionName: string;
  dialect: Dialect;
  database: string;
  sql: string;
  limit: number;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface IAIQueryResult {
  rows: Record<string, unknown>[];
  columns?: string[];
}

export interface IAIChatMessage extends IAIChatMessageInput {
  id: string;
  created_at: string;
  queryApprovals?: IAIQueryApproval[];
  queryResult?: IAIQueryResult;
}

export interface IAIChat {
  id: string;
  title: string;
  summary: string;
  messages: IAIChatMessage[];
  providerId?: string;
  model?: string;
  created_at: string;
  updated_at: string;
}

export interface IAIChatCreate {
  id?: string;
  title: string;
  summary?: string;
  messages?: IAIChatMessage[];
  providerId?: string;
  model?: string;
}

export interface IAIChatPatch {
  title?: string;
  summary?: string;
  messages?: IAIChatMessage[];
  providerId?: string;
  model?: string;
}

export interface IAIChatAppendMessages {
  title?: string;
  summary?: string;
  messages: IAIChatMessage[];
}

export interface IAIChatRequest {
  providerId?: string;
  model?: string;
  mentionedConnectionIds?: string[];
  messages: IAIChatMessageInput[];
}

export interface IAIChatResponse {
  content: string;
}

export interface ICodexChatGPTAccount {
  authenticated: boolean;
  email?: string | null;
  planType?: string | null;
  authMode?: string | null;
}

export interface ICodexChatGPTLoginStart {
  loginId: string;
  verificationUrl: string;
  userCode: string;
}

export interface IProjectCreate {
  description: string;
}

export interface IProject extends IProjectCreate {
  id: string;
}

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
}

export interface IConnectionInfo {
  tables: ITable[];
  functions: IFunctionDb[];
  schemas?: string[];
}

export type ConnectionEnvironment = 'development' | 'production';

export interface IConnectionCreate {
  id_project: string;
  description: string;
  dialect: Dialect;
  environment?: ConnectionEnvironment;
  database: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export interface IConnection extends IConnectionCreate {
  id: string;
}

export type ImportConnectionsSource = 'dbeaver';

export interface IImportConnectionsSelection {
  projects: { sourceName: string; connections: string[] }[];
}

export interface IImportConnectionsParams {
  source: ImportConnectionsSource;
  path: string;
  masterPassword?: string;
  selection?: IImportConnectionsSelection;
}

export interface IImportConnectionsPreviewConnection {
  sourceId: string;
  description: string;
  dialect: Dialect;
  host: string;
  port: number;
  database: string;
  username?: string;
  hasPassword: boolean;
  alreadyExists: boolean;
}

export interface IImportConnectionsPreviewProject {
  sourceName: string;
  description: string;
  connections: IImportConnectionsPreviewConnection[];
}

export interface IImportConnectionsPreview {
  path: string;
  projects: IImportConnectionsPreviewProject[];
  unsupportedConnections: { name: string; driver?: string }[];
  credentialsFiles: number;
  credentialsImported: number;
  credentialsMissing: number;
  requiresMasterPassword: boolean;
  warnings: string[];
}

export interface IImportConnectionsResult {
  projectsCreated: number;
  projectsReused: number;
  connectionsImported: number;
  connectionsSkipped: number;
  unsupportedConnections: { name: string; driver?: string }[];
  credentialsFiles: number;
  credentialsImported: number;
  credentialsMissing: number;
  warnings: string[];
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

export type ConstraintType = 'primary_key' | 'unique_key' | 'check';

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

export type DbCellValue = string | number | boolean | Date | null;

export interface IImportTableDataParams {
  schema?: string;
  table: string;
  rows: Record<string, DbCellValue>[];
}

export interface IImportTableDataResult {
  insertedRows: number;
}

export interface IStoreContext {
  connections: IConnection[];
  previewImportConnectionsFromSource(
    params: IImportConnectionsParams,
  ): Promise<IImportConnectionsPreview>;
  importConnectionsFromSource(params: IImportConnectionsParams): Promise<IImportConnectionsResult>;
  addConnection(data: IConnectionCreate): Promise<void>;
  removeConnection(id: string): Promise<void>;
  editConnection(id: string, data: IConnectionCreate): Promise<void>;

  projects: IProject[];
  addProject(data: IProjectCreate): Promise<void>;
  removeProject(id: string): Promise<void>;
  editProject(id: string, data: IProjectCreate): Promise<void>;

  scripts: IScript[];
  addScript(data: Omit<IScript, 'id'>): Promise<IScript>;
  editScript(id: string, data: Partial<IScript>): Promise<void>;
  removeScript(id: string): Promise<void>;
  getScriptContent(id: string): Promise<string>;

  snippets: ISnippet[];
  addSnippet(data: Omit<ISnippet, 'id'>): Promise<ISnippet>;
  editSnippet(id: string, data: Omit<ISnippet, 'id'>): Promise<void>;
  removeSnippet(id: string): Promise<void>;

  aiProviders: IAIProvider[];
  addAIProvider(data: IAIProviderCreate): Promise<void>;
  editAIProvider(id: string, data: IAIProviderCreate): Promise<void>;
  removeAIProvider(id: string): Promise<void>;
  testAIProvider(data: IAIProviderCreate): Promise<boolean>;
  sendAIChatMessage(data: IAIChatRequest): Promise<IAIChatResponse>;
  aiChats: IAIChat[];
  addAIChat(data: IAIChatCreate): Promise<IAIChat>;
  editAIChat(id: string, data: IAIChatPatch): Promise<void>;
  removeAIChat(id: string): Promise<void>;
  appendAIChatMessages(id: string, data: IAIChatAppendMessages): Promise<void>;
  getCodexChatGPTAccount(): Promise<ICodexChatGPTAccount>;
  startCodexChatGPTLogin(): Promise<ICodexChatGPTLoginStart>;
  logoutCodexChatGPT(): Promise<void>;

  connectionsGroupPerProject: IConnectionsGroupPerProject[];

  connectionTypes?: string[];
  connectionsInfo: Map<string, IConnectionInfo>;

  loadConnectionInfo(id: string): Promise<void>;
  testConnection(data: IConnectionCreate): Promise<boolean>;
  closeConnection(id: string): Promise<void>;
  getTableData(idConnection: string, params: IParamsGetTableData): Promise<IDataTable>;
  getTableRowsCount(
    idConnection: string,
    params: Omit<IParamsGetTableData, 'page' | 'limit' | 'orderBy'>,
  ): Promise<number>;
  getQueryRowsCount(idConnection: string, sql: string): Promise<number>;

  getTableColumns(
    idConnection: string,
    filters: { table: string; schema: string },
  ): Promise<IColumnInfo[]>;

  getColumnTypes(idConnection: string): Promise<{ name: string }[]>;

  getTableReferences(
    idConnection: string,
    filters: { table: string; schema: string },
  ): Promise<IColumnReferenceInfo[]>;

  getTableUsedAsReference(
    idConnection: string,
    filters: { table: string; schema: string },
  ): Promise<IColumnReferenceInfo[]>;

  getTableRestrictions(
    idConnection: string,
    filters: { table: string; schema: string },
  ): Promise<IColumnRestrictionsInfo[]>;

  getTableDefinition(
    idConnection: string,
    filters: { table: string; schema: string },
  ): Promise<{ definition: string }[]>;

  getTableIndexes(
    idConnection: string,
    filters: { table: string; schema: string },
  ): Promise<IIndexInfo[]>;

  getTableTriggers(
    idConnection: string,
    filters: { table: string; schema: string },
  ): Promise<ITriggerInfo[]>;

  getFunctionDefinition(
    idConnection: string,
    filters: { schema: string; functionName: string },
  ): Promise<{ definition: string }[]>;

  getServerOutput(idConnection: string): Promise<IServerOutputMessage[]>;
  clearServerOutput(idConnection: string): Promise<void>;

  runSql(
    idConnection: string,
    sql: string,
    options?: IOptionsRunSql,
  ): Promise<
    {
      type: string;
      rows?: any[];
      columns?: string[];
      columns_info?: { name: string; type?: string }[];
      affected_rows?: number;
      auto_paginated?: boolean;
      execution_time_ms?: number;
    }[]
  >;
  runExplainSql(
    idConnection: string,
    sql: string,
    options?: Pick<IOptionsRunSql, 'queryExecutionId'>,
  ): Promise<
    {
      type: string;
      rows?: any[];
      columns?: string[];
      columns_info?: { name: string; type?: string }[];
      affected_rows?: number;
      auto_paginated?: boolean;
      execution_time_ms?: number;
    }[]
  >;
  cancelRunSql(idConnection: string, queryExecutionId: string): Promise<boolean>;
  importTableData(
    idConnection: string,
    params: IImportTableDataParams,
  ): Promise<IImportTableDataResult>;
}

export interface IConnectionsGroupPerProject extends IProject {
  connections: IConnection[];
}

export default createContext<IStoreContext>({} as IStoreContext);
