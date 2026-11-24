import { prepareInsertDml } from './rowChanges/insertDml';
import { prepareStructureDdl } from './structure/ddl';
import addListener from '../utils/addListener';
import {
  getDialects,
  readInitialWhere,
  prepareInitialWhere,
  getConnectionInfo,
  getTableData,
  getTableRowsCount,
  getQueryRowsCount,
  getTableColumns,
  getColumnGridData,
  getColumnTypes,
  getTableReferences,
  getTableUsedAsReference,
  getTableRestrictions,
  getTableDefinition,
  getTableIndexes,
  getTableTriggers,
  getFunctionDefinition,
  saveRowChanges,
  getProcessList,
  cancelProcess,
  compareDatabases,
} from './core';
import { getExportDataPreview, exportData, cancelExport, importTableData, cancelImport } from './transfer';
import { runSql, cancelRunSql, runExplainSql, executeObjectCommand } from './execution';
import { testConnection, closeConnection, getServerOutput, clearServerOutput } from './connections';

// dialect
addListener('@get:dialects', getDialects);
addListener('@post:read_initial_where', readInitialWhere);
addListener('@post:prepare_initial_where', prepareInitialWhere);
addListener('@get:test_connection', testConnection);
addListener('@get:close_connection', closeConnection);
addListener('@get:connection_info', getConnectionInfo);
addListener('@get:table_data', getTableData);
addListener('@get:table_rows_count', getTableRowsCount);
addListener('@get:query_rows_count', getQueryRowsCount);
addListener('@get:export_data_preview', getExportDataPreview);
addListener('@get:table_columns', getTableColumns);
addListener('@get:column_grid_data', getColumnGridData);
addListener('@post:prepare_insert_dml', prepareInsertDml);
addListener('@post:prepare_structure_ddl', prepareStructureDdl);
addListener('@get:column_types', getColumnTypes);
addListener('@get:table_references', getTableReferences);
addListener('@get:table_used_as_reference', getTableUsedAsReference);
addListener('@get:table_restrictions', getTableRestrictions);
addListener('@get:table_definition', getTableDefinition);
addListener('@get:table_indexes', getTableIndexes);
addListener('@get:table_triggers', getTableTriggers);
addListener('@get:function_definition', getFunctionDefinition);
addListener('@post:execute_object_command', executeObjectCommand);
addListener('@post:run_sql', runSql);
addListener('@post:save_row_changes', saveRowChanges);
addListener('@post:run_explain_sql', runExplainSql);
addListener('@post:export_data', exportData);
addListener('@post:cancel_export', cancelExport);
addListener('@post:import_table_data', importTableData);
addListener('@post:cancel_import', cancelImport);
addListener('@post:cancel_run_sql', cancelRunSql);
addListener('@get:server_output', getServerOutput);
addListener('@delete:server_output', clearServerOutput);
addListener('@get:process_list', getProcessList);
addListener('@post:cancel_process', cancelProcess);
addListener('@post:compare_databases', compareDatabases);

