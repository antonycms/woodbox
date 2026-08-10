import type { Knex } from 'knex';

declare global {
  export type Dialect = 'postgres' | 'mysql' | 'sqlite';
  export type ConnectionEnvironment = 'development' | 'production';

  export interface IConnectionConfig {
    id: string;
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

  export interface IConnection {
    id: string;
    instance: Knex<any, unknown[]>;
    dialect: Dialect;
  }

  export interface IScript {
    id: string;
    name: string;
    id_connection: string;
    content: string;
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
    | 'openai-compatible'
    | 'codex-chatgpt';

  export interface IAIProviderConfig {
    id: string;
    name: string;
    type: AIProviderType;
    model: string;
    apiKey?: string;
    baseURL?: string;
    isDefault?: boolean;
    created_at: string;
    updated_at: string;
  }

  export interface IAIProviderPublic
    extends Omit<IAIProviderConfig, 'apiKey'> {
    hasApiKey: boolean;
  }

  export interface IAIProviderInput {
    id?: string;
    name: string;
    type: AIProviderType;
    model: string;
    apiKey?: string;
    baseURL?: string;
    isDefault?: boolean;
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
    created_at: string;
    updated_at: string;
  }

  export interface IAIChatInput {
    id?: string;
    title: string;
    summary?: string;
    messages?: IAIChatMessage[];
  }

  export interface IAIChatPatch {
    title?: string;
    summary?: string;
    messages?: IAIChatMessage[];
  }

  export interface IAIChatAppendMessagesInput {
    title?: string;
    summary?: string;
    messages: IAIChatMessage[];
  }

  export interface IAIChatRequest {
    providerId?: string;
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

  export interface IProject {
    id: string;
    description: string;
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

  export type DbCellValue = string | number | boolean | Date | null;

  export interface IImportTableDataParams {
    schema?: string;
    table: string;
    rows: Record<string, DbCellValue>[];
  }

  export interface IImportTableDataResult {
    insertedRows: number;
  }
}
