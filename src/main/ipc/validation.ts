import { z } from 'zod';
import type { IpcArgs, IpcChannel } from '@shared/types/ipc';
import { connection, importConnections } from './schemas/connections';
import { project, script, snippet } from './schemas/workspace';
import { provider, chat, chatPatch, appendMessages, chatRequest } from './schemas/ai';
import {
  tableFilters, tableData, runSqlOptions, exportPreview, exportData, importTableData, compare,
} from './schemas/database';

const id = z.string().min(1);

const schemas = {
  '@get:config_connections_saved': z.tuple([]),
  '@get:config_connection_saved': z.tuple([id]),
  '@add:config_connections_saved': z.tuple([connection.extend({ id })]),
  '@edit:config_connections_saved': z.tuple([id, connection]),
  '@remove:config_connections_saved': z.tuple([id]),
  '@get:test_connection': z.tuple([connection.extend({ id: id.optional() })]),
  '@get:close_connection': z.tuple([id]),
  '@get:connection_info': z.tuple([id]),
  '@post:preview_import_connections_from_source': z.tuple([importConnections]),
  '@post:import_connections_from_source': z.tuple([importConnections]),
  '@get:projects': z.tuple([]),
  '@add:projects': z.tuple([project]),
  '@edit:projects': z.tuple([id, project]),
  '@remove:projects': z.tuple([id]),
  '@get:scripts_meta': z.tuple([]),
  '@get:script_content': z.tuple([id]),
  '@add:scripts': z.tuple([script]),
  '@patch:scripts': z.tuple([id, script.partial()]),
  '@remove:scripts': z.tuple([id]),
  '@get:snippets': z.tuple([]),
  '@add:snippets': z.tuple([snippet]),
  '@edit:snippets': z.tuple([id, snippet]),
  '@remove:snippets': z.tuple([id]),
  '@get:ai_providers': z.tuple([]),
  '@add:ai_providers': z.tuple([provider]),
  '@edit:ai_providers': z.tuple([id, provider]),
  '@remove:ai_providers': z.tuple([id]),
  '@post:test_ai_provider': z.tuple([provider]),
  '@get:ai_chats': z.tuple([]),
  '@add:ai_chats': z.tuple([chat]),
  '@edit:ai_chats': z.tuple([id, chatPatch]),
  '@remove:ai_chats': z.tuple([id]),
  '@post:append_ai_chat_messages': z.tuple([id, appendMessages]),
  '@post:ai_chat_message': z.tuple([chatRequest]),
  '@post:cancel_ai_chat_message': z.tuple([id]),
  '@get:codex_chatgpt_account': z.tuple([]),
  '@post:codex_chatgpt_login': z.tuple([]),
  '@post:codex_chatgpt_logout': z.tuple([]),
  '@get:react_native_bridge_status': z.tuple([]),
  '@get:react_native_bridge_sessions': z.tuple([]),
  '@post:react_native_bridge_start_gateway': z.tuple([z.string().optional(), z.object({ host: z.string().optional(), port: z.number().optional() }).optional()]),
  '@post:react_native_bridge_stop_gateway': z.tuple([z.string().optional()]),
  '@get:dialects': z.tuple([]),
  '@get:table_data': z.tuple([id, tableData]),
  '@get:table_rows_count': z.tuple([id, tableFilters.extend({ where: z.string().optional() })]),
  '@get:query_rows_count': z.tuple([id, z.string()]),
  '@get:export_data_preview': z.tuple([id, exportPreview]),
  '@get:table_columns': z.tuple([id, tableFilters]),
  '@get:column_types': z.tuple([id]),
  '@get:table_references': z.tuple([id, tableFilters]),
  '@get:table_used_as_reference': z.tuple([id, tableFilters]),
  '@get:table_restrictions': z.tuple([id, tableFilters]),
  '@get:table_definition': z.tuple([id, tableFilters]),
  '@get:table_indexes': z.tuple([id, tableFilters]),
  '@get:table_triggers': z.tuple([id, tableFilters]),
  '@get:function_definition': z.tuple([id, z.object({ schema: z.string(), functionName: z.string(), functionIdentityArguments: z.string().optional() })]),
  '@post:run_sql': z.tuple([id, z.string(), runSqlOptions.optional()]),
  '@post:run_explain_sql': z.tuple([id, z.string(), runSqlOptions.pick({ queryExecutionId: true }).optional()]),
  '@post:export_data': z.tuple([id, exportData]),
  '@post:import_table_data': z.tuple([id, importTableData]),
  '@post:cancel_run_sql': z.tuple([id, id]),
  '@get:server_output': z.tuple([id]),
  '@delete:server_output': z.tuple([id]),
  '@get:process_list': z.tuple([id]),
  '@post:cancel_process': z.tuple([id, z.union([z.string(), z.number()])]),
  '@post:compare_databases': z.tuple([compare]),
  '@dialog:select_sqlite_file': z.tuple([]),
  '@dialog:select_dbeaver_export_file': z.tuple([]),
  '@dialog:select_ssl_file': z.tuple([]),
  '@dialog:select_ssh_key': z.tuple([]),
  '@post:download_update': z.tuple([]),
  '@post:quit_and_install_update': z.tuple([]),
} satisfies { [C in IpcChannel]: z.ZodType<IpcArgs<C>> };

export const parseIpcArgs = <C extends IpcChannel>(channel: C, args: unknown[]): IpcArgs<C> => {
  const parsed = schemas[channel].safeParse(args);
  if (!parsed.success) throw new Error('Parâmetros inválidos para esta operação.');
  // The mapped schema contract above checks each tuple; indexing loses that generic correlation.
  return parsed.data as IpcArgs<C>;
};
