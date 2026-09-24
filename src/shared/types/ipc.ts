import type { WoodboxApi } from './api';

export interface IpcRequests {
  '@get:config_connections_saved': WoodboxApi['connections']['list'];
  '@get:config_connection_saved': WoodboxApi['connections']['get'];
  '@add:config_connections_saved': WoodboxApi['connections']['add'];
  '@edit:config_connections_saved': WoodboxApi['connections']['edit'];
  '@remove:config_connections_saved': WoodboxApi['connections']['remove'];
  '@get:test_connection': WoodboxApi['connections']['test'];
  '@get:close_connection': WoodboxApi['connections']['close'];
  '@get:connection_info': WoodboxApi['connections']['getInfo'];
  '@post:preview_import_connections_from_source': WoodboxApi['connections']['previewImport'];
  '@post:import_connections_from_source': WoodboxApi['connections']['import'];
  '@get:projects': WoodboxApi['projects']['list'];
  '@add:projects': WoodboxApi['projects']['add'];
  '@edit:projects': WoodboxApi['projects']['edit'];
  '@remove:projects': WoodboxApi['projects']['remove'];
  '@get:scripts_meta': WoodboxApi['scripts']['list'];
  '@get:script_content': WoodboxApi['scripts']['getContent'];
  '@add:scripts': WoodboxApi['scripts']['add'];
  '@patch:scripts': WoodboxApi['scripts']['edit'];
  '@remove:scripts': WoodboxApi['scripts']['remove'];
  '@get:snippets': WoodboxApi['snippets']['list'];
  '@add:snippets': WoodboxApi['snippets']['add'];
  '@edit:snippets': WoodboxApi['snippets']['edit'];
  '@remove:snippets': WoodboxApi['snippets']['remove'];
  '@get:ai_providers': WoodboxApi['aiProviders']['list'];
  '@add:ai_providers': WoodboxApi['aiProviders']['add'];
  '@edit:ai_providers': WoodboxApi['aiProviders']['edit'];
  '@remove:ai_providers': WoodboxApi['aiProviders']['remove'];
  '@post:test_ai_provider': WoodboxApi['aiProviders']['test'];
  '@get:ai_chats': WoodboxApi['aiChats']['list'];
  '@add:ai_chats': WoodboxApi['aiChats']['add'];
  '@edit:ai_chats': WoodboxApi['aiChats']['edit'];
  '@remove:ai_chats': WoodboxApi['aiChats']['remove'];
  '@post:append_ai_chat_messages': WoodboxApi['aiChats']['appendMessages'];
  '@post:ai_chat_message': WoodboxApi['aiChats']['sendMessage'];
  '@post:cancel_ai_chat_message': WoodboxApi['aiChats']['cancelMessage'];
  '@get:app_preferences': WoodboxApi['preferences']['get'];
  '@post:app_preferences': WoodboxApi['preferences']['set'];
  '@get:codex_chatgpt_account': WoodboxApi['codex']['getAccount'];
  '@post:codex_chatgpt_login': WoodboxApi['codex']['startLogin'];
  '@post:codex_chatgpt_logout': WoodboxApi['codex']['logout'];
  '@get:react_native_bridge_status': WoodboxApi['reactNativeBridge']['getStatus'];
  '@get:react_native_bridge_sessions': WoodboxApi['reactNativeBridge']['getSessions'];
  '@post:react_native_bridge_start_gateway': WoodboxApi['reactNativeBridge']['start'];
  '@post:react_native_bridge_stop_gateway': WoodboxApi['reactNativeBridge']['stop'];
  '@get:dialects': WoodboxApi['database']['getDialects'];
  '@get:table_data': WoodboxApi['database']['getTableData'];
  '@get:table_rows_count': WoodboxApi['database']['getTableRowsCount'];
  '@get:query_rows_count': WoodboxApi['database']['getQueryRowsCount'];
  '@get:export_data_preview': WoodboxApi['database']['getExportPreview'];
  '@get:table_columns': WoodboxApi['database']['getTableColumns'];
  '@get:column_types': WoodboxApi['database']['getColumnTypes'];
  '@get:table_references': WoodboxApi['database']['getTableReferences'];
  '@get:table_used_as_reference': WoodboxApi['database']['getTableUsedAsReference'];
  '@get:table_restrictions': WoodboxApi['database']['getTableRestrictions'];
  '@get:table_definition': WoodboxApi['database']['getTableDefinition'];
  '@get:table_indexes': WoodboxApi['database']['getTableIndexes'];
  '@get:table_triggers': WoodboxApi['database']['getTableTriggers'];
  '@get:function_definition': WoodboxApi['database']['getFunctionDefinition'];
  '@post:run_sql': WoodboxApi['database']['runSql'];
  '@post:run_explain_sql': WoodboxApi['database']['runExplainSql'];
  '@post:export_data': WoodboxApi['database']['exportData'];
  '@post:import_table_data': WoodboxApi['database']['importTableData'];
  '@post:cancel_run_sql': WoodboxApi['database']['cancelRunSql'];
  '@get:server_output': WoodboxApi['database']['getServerOutput'];
  '@delete:server_output': WoodboxApi['database']['clearServerOutput'];
  '@get:process_list': WoodboxApi['database']['getProcessList'];
  '@post:cancel_process': WoodboxApi['database']['cancelProcess'];
  '@post:compare_databases': WoodboxApi['database']['compare'];
  '@dialog:select_sqlite_file': WoodboxApi['dialogs']['selectSqliteFile'];
  '@dialog:select_dbeaver_export_file': WoodboxApi['dialogs']['selectDbeaverExportFile'];
  '@dialog:select_ssl_file': WoodboxApi['dialogs']['selectSslFile'];
  '@dialog:select_ssh_key': WoodboxApi['dialogs']['selectSshKey'];
  '@post:download_update': WoodboxApi['updates']['download'];
  '@post:quit_and_install_update': WoodboxApi['updates']['quitAndInstall'];
}

export interface IpcEvents {
  '@event:server_output': Parameters<Parameters<WoodboxApi['database']['onServerOutput']>[0]>[0];
  '@event:update_available': Parameters<Parameters<WoodboxApi['updates']['onAvailable']>[0]>[0];
  '@event:update_download_progress': Parameters<Parameters<WoodboxApi['updates']['onProgress']>[0]>[0];
  '@event:update_downloaded': Parameters<Parameters<WoodboxApi['updates']['onDownloaded']>[0]>[0];
  '@event:update_error': Parameters<Parameters<WoodboxApi['updates']['onError']>[0]>[0];
  '@event:react_native_bridge_event': Parameters<Parameters<WoodboxApi['reactNativeBridge']['onEvent']>[0]>[0];
  '@event:react_native_bridge_session_connected': Parameters<Parameters<WoodboxApi['reactNativeBridge']['onSessionConnected']>[0]>[0];
  '@event:react_native_bridge_session_disconnected': Parameters<Parameters<WoodboxApi['reactNativeBridge']['onSessionDisconnected']>[0]>[0];
}

export type IpcChannel = keyof IpcRequests;
export type IpcArgs<C extends IpcChannel> = Parameters<IpcRequests[C]>;
export type IpcData<C extends IpcChannel> = Awaited<ReturnType<IpcRequests[C]>>;

export interface IpcError {
  message: string;
  position?: string;
  code?: string;
}

export type IpcResponse<T> =
  | { data: T; error: null }
  | { data: null; error: IpcError };
