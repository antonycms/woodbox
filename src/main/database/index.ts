import addListener from '@main/utils/addListener';
import {
  getDialects,
  testConnection,
  closeConnection,
  getConnectionInfo,
  getTableData,
  getTableRowsCount,
  getQueryRowsCount,
  getExportDataPreview,
  getTableColumns,
  getColumnTypes,
  getTableReferences,
  getTableUsedAsReference,
  getTableRestrictions,
  getTableDefinition,
  getTableIndexes,
  getTableTriggers,
  getFunctionDefinition,
  runSql,
  runExplainSql,
  exportData,
  importTableData,
  cancelRunSql,
  getServerOutput,
  clearServerOutput,
} from './core';

// dialect
addListener('@get:dialects', getDialects);
addListener('@get:test_connection', testConnection);
addListener('@get:close_connection', closeConnection);
addListener('@get:connection_info', getConnectionInfo);
addListener('@get:table_data', getTableData);
addListener('@get:table_rows_count', getTableRowsCount);
addListener('@get:query_rows_count', getQueryRowsCount);
addListener('@get:export_data_preview', getExportDataPreview);
addListener('@get:table_columns', getTableColumns);
addListener('@get:column_types', getColumnTypes);
addListener('@get:table_references', getTableReferences);
addListener('@get:table_used_as_reference', getTableUsedAsReference);
addListener('@get:table_restrictions', getTableRestrictions);
addListener('@get:table_definition', getTableDefinition);
addListener('@get:table_indexes', getTableIndexes);
addListener('@get:table_triggers', getTableTriggers);
addListener('@get:function_definition', getFunctionDefinition);
addListener('@post:run_sql', runSql);
addListener('@post:run_explain_sql', runExplainSql);
addListener('@post:export_data', exportData);
addListener('@post:import_table_data', importTableData);
addListener('@post:cancel_run_sql', cancelRunSql);
addListener('@get:server_output', getServerOutput);
addListener('@delete:server_output', clearServerOutput);

export { closeAllConnections } from './core';
