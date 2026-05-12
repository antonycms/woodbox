import addListener from '../utils/addListener';
import {
  getDialects,
  testConnection,
  closeConnection,
  getConnectionInfo,
  getTableData,
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
} from './core';

// dialect
addListener('@get:dialects', getDialects);
addListener('@get:test_connection', testConnection);
addListener('@get:close_connection', closeConnection);
addListener('@get:connection_info', getConnectionInfo);
addListener('@get:table_data', getTableData);
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

export { closeAllConnections } from './core';
