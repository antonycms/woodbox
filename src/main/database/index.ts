import addListener from '../utils/addListener';
import {
  testConnection,
  closeConnection,
  getConnectionInfo,
  getTableData,
  getTableColumns,
  getTableReferences,
  getTableUsedAsReference,
  getTableRestrictions,
  getTableDefinition,
  getTableIndexes,
  getTableTriggers,
  getFunctionDefinition,
  runSql,
} from './core';

addListener('@get:test_connection', testConnection);
addListener('@get:close_connection', closeConnection);
addListener('@get:connection_info', getConnectionInfo);
addListener('@get:table_data', getTableData);
addListener('@get:table_columns', getTableColumns);
addListener('@get:table_references', getTableReferences);
addListener('@get:table_used_as_reference', getTableUsedAsReference);
addListener('@get:table_restrictions', getTableRestrictions);
addListener('@get:table_definition', getTableDefinition);
addListener('@get:table_indexes', getTableIndexes);
addListener('@get:table_triggers', getTableTriggers);
addListener('@get:function_definition', getFunctionDefinition);
addListener('@post:run_sql', runSql);

export { closeAllConnections } from './core';
