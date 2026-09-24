import type * as Connections from './connections';
import type * as Workspace from './workspace';
import type * as Database from './database';
import type * as Imports from './imports';
import type * as AI from './ai';
import type * as Bridge from './reactNativeBridge';
import type * as Compare from './databaseCompare';
import type * as Updates from './updates';

import type * as Preferences from './preferences';
export type Unsubscribe = () => void;

type TableFilters = { table: string; schema?: string };

export interface WoodboxApi {
  connections: {
    list: () => Promise<Connections.IConnectionPublic[]>;
    get: (id: string) => Promise<Connections.IConnectionPublic | undefined>;
    add: (data: Connections.IConnectionConfig) => Promise<void>;
    edit: (id: string, data: Connections.IConnectionCreate) => Promise<void>;
    remove: (id: string) => Promise<void>;
    test: (data: Connections.IConnectionCreate & { id?: string }) => Promise<void>;
    close: (id: string) => Promise<void>;
    getInfo: (id: string) => Promise<Database.IConnectionInfo | null>;
    previewImport: (params: Imports.IImportConnectionsParams) => Promise<Imports.IImportConnectionsPreview>;
    import: (params: Imports.IImportConnectionsParams) => Promise<Imports.IImportConnectionsResult>;
  };
  projects: {
    list: () => Promise<Workspace.IProject[]>;
    add: (data: Workspace.IProject) => Promise<void>;
    edit: (id: string, data: Workspace.IProject) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  scripts: {
    list: () => Promise<Workspace.IScriptMetadata[]>;
    getContent: (id: string) => Promise<string>;
    add: (data: Workspace.IScriptMetadata) => Promise<void>;
    edit: (id: string, data: Partial<Workspace.IScript>) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  snippets: {
    list: () => Promise<Workspace.ISnippet[]>;
    add: (data: Workspace.ISnippet) => Promise<void>;
    edit: (id: string, data: Workspace.ISnippet) => Promise<void>;
    remove: (id: string) => Promise<void>;
  };
  aiProviders: {
    list: () => Promise<AI.IAIProviderPublic[]>;
    add: (data: AI.IAIProviderInput) => Promise<void>;
    edit: (id: string, data: AI.IAIProviderInput) => Promise<void>;
    remove: (id: string) => Promise<void>;
    test: (data: AI.IAIProviderInput) => Promise<boolean>;
  };
  aiChats: {
    list: () => Promise<AI.IAIChat[]>;
    add: (data: AI.IAIChatInput) => Promise<AI.IAIChat>;
    edit: (id: string, data: AI.IAIChatPatch) => Promise<void>;
    remove: (id: string) => Promise<void>;
    appendMessages: (id: string, data: AI.IAIChatAppendMessagesInput) => Promise<void>;
    sendMessage: (data: AI.IAIChatRequest) => Promise<AI.IAIChatResponse>;
    cancelMessage: (requestId: string) => Promise<boolean>;
  };
  preferences: {
    get: () => Promise<Preferences.AppPreferences>;
    set: (preferences: Preferences.AppPreferencesPatch) => Promise<void>;
  };
  codex: {
    getAccount: () => Promise<AI.ICodexChatGPTAccount>;
    startLogin: () => Promise<AI.ICodexChatGPTLoginStart>;
    logout: () => Promise<void>;
  };
  reactNativeBridge: {
    getStatus: () => Promise<Bridge.ReactNativeBridgeStatus>;
    getSessions: () => Promise<Bridge.ReactNativeBridgeSessionInfo[]>;
    start: (source?: string, options?: { host?: string; port?: number }) => Promise<Bridge.ReactNativeBridgeStatus>;
    stop: (source?: string) => Promise<void>;
    onEvent: (listener: (data: Bridge.ReactNativeBridgeEvent) => void) => Unsubscribe;
    onSessionConnected: (listener: (data: Bridge.ReactNativeBridgeSessionInfo[]) => void) => Unsubscribe;
    onSessionDisconnected: (listener: (data: Bridge.ReactNativeBridgeSessionInfo[]) => void) => Unsubscribe;
  };
  database: {
    getDialects: () => Promise<Connections.Dialect[]>;
    getTableData: (connectionId: string, params: Database.IParamsGetTableData) => Promise<Database.IDataTable>;
    getTableRowsCount: (connectionId: string, params: Omit<Database.IParamsGetTableData, 'page' | 'limit' | 'orderBy'>) => Promise<number>;
    getQueryRowsCount: (connectionId: string, sql: string) => Promise<number>;
    getExportPreview: (connectionId: string, params: Pick<Database.IExportDataParams, 'source'>) => Promise<Database.IExportDataPreview>;
    getTableColumns: (connectionId: string, filters: TableFilters) => Promise<Database.IColumnInfo[]>;
    getColumnTypes: (connectionId: string) => Promise<{ name: string }[]>;
    getTableReferences: (connectionId: string, filters: TableFilters) => Promise<Database.IColumnReferenceInfo[]>;
    getTableUsedAsReference: (connectionId: string, filters: TableFilters) => Promise<Database.IColumnReferenceInfo[]>;
    getTableRestrictions: (connectionId: string, filters: TableFilters) => Promise<Database.IColumnRestrictionsInfo[]>;
    getTableDefinition: (connectionId: string, filters: TableFilters) => Promise<{ definition: string }[]>;
    getTableIndexes: (connectionId: string, filters: TableFilters) => Promise<Database.IIndexInfo[]>;
    getTableTriggers: (connectionId: string, filters: TableFilters) => Promise<Database.ITriggerInfo[]>;
    getFunctionDefinition: (connectionId: string, filters: { schema: string; functionName: string; functionIdentityArguments?: string }) => Promise<{ definition: string }[]>;
    runSql: (connectionId: string, sql: string, options?: Database.IOptionsRunSql) => Promise<Database.IRunSqlResult[]>;
    runExplainSql: (connectionId: string, sql: string, options?: Pick<Database.IOptionsRunSql, 'queryExecutionId'>) => Promise<Database.IRunSqlResult[]>;
    exportData: (connectionId: string, params: Database.IExportDataParams) => Promise<Database.IExportDataResult>;
    importTableData: (connectionId: string, params: Database.IImportTableDataParams) => Promise<Database.IImportTableDataResult>;
    cancelRunSql: (connectionId: string, queryExecutionId: string) => Promise<boolean>;
    getServerOutput: (connectionId: string) => Promise<Database.IServerOutputMessage[]>;
    clearServerOutput: (connectionId: string) => Promise<void>;
    getProcessList: (connectionId: string) => Promise<Database.IDatabaseProcess[]>;
    cancelProcess: (connectionId: string, pid: string | number) => Promise<boolean>;
    compare: (params: Compare.DatabaseCompareParams) => Promise<Compare.DatabaseCompareResult>;
    onServerOutput: (listener: (data: Database.IServerOutputMessage) => void) => Unsubscribe;
  };
  dialogs: {
    selectSqliteFile: () => Promise<string | null>;
    selectDbeaverExportFile: () => Promise<string | null>;
    selectSslFile: () => Promise<string | null>;
    selectSshKey: () => Promise<string | null>;
  };
  updates: {
    download: () => Promise<void>;
    quitAndInstall: () => Promise<void>;
    onAvailable: (listener: (data: Updates.UpdateAvailablePayload) => void) => Unsubscribe;
    onProgress: (listener: (data: Updates.UpdateProgressPayload) => void) => Unsubscribe;
    onDownloaded: (listener: (data: Updates.UpdateAvailablePayload) => void) => Unsubscribe;
    onError: (listener: (data: { message: string }) => void) => Unsubscribe;
  };
}
