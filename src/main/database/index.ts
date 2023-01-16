import addListener from '../utils/addListener';
import {
  testConnection,
  closeConnection,
  getConnectionInfo,
  getTableData,
  getTableColumns,
  getTableReferences,
  getTableRestrictions,
} from './core';

addListener('@get:test_connection', testConnection);
addListener('@get:close_connection', closeConnection);
addListener('@get:connection_info', getConnectionInfo);
addListener('@get:table_data', getTableData);
addListener('@get:table_columns', getTableColumns);
addListener('@get:table_references', getTableReferences);
addListener('@get:table_restrictions', getTableRestrictions);
