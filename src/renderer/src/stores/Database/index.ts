import { create } from 'zustand';
import type { WoodboxApi } from '@shared/types/api';

export const useDatabaseStore = create<WoodboxApi['database']>()(() => ({
  getDialects: (...args) => window.api.database.getDialects(...args),
  getTableData: (connectionId, { page = 1, limit = 200, ...params }) =>
    window.api.database.getTableData(connectionId, { ...params, page, limit }),
  getTableRowsCount: (...args) => window.api.database.getTableRowsCount(...args),
  getQueryRowsCount: (...args) => window.api.database.getQueryRowsCount(...args),
  getExportPreview: (...args) => window.api.database.getExportPreview(...args),
  getTableColumns: (...args) => window.api.database.getTableColumns(...args),
  getColumnTypes: (...args) => window.api.database.getColumnTypes(...args),
  getTableReferences: (...args) => window.api.database.getTableReferences(...args),
  getTableUsedAsReference: (...args) => window.api.database.getTableUsedAsReference(...args),
  getTableRestrictions: (...args) => window.api.database.getTableRestrictions(...args),
  getTableDefinition: (...args) => window.api.database.getTableDefinition(...args),
  getTableIndexes: (...args) => window.api.database.getTableIndexes(...args),
  getTableTriggers: (...args) => window.api.database.getTableTriggers(...args),
  getFunctionDefinition: (...args) => window.api.database.getFunctionDefinition(...args),
  runSql: (...args) => window.api.database.runSql(...args),
  runExplainSql: (...args) => window.api.database.runExplainSql(...args),
  exportData: (...args) => window.api.database.exportData(...args),
  importTableData: (...args) => window.api.database.importTableData(...args),
  cancelRunSql: (...args) => window.api.database.cancelRunSql(...args),
  getServerOutput: (...args) => window.api.database.getServerOutput(...args),
  clearServerOutput: (...args) => window.api.database.clearServerOutput(...args),
  getProcessList: (...args) => window.api.database.getProcessList(...args),
  cancelProcess: (...args) => window.api.database.cancelProcess(...args),
  compare: (...args) => window.api.database.compare(...args),
  onServerOutput: (...args) => window.api.database.onServerOutput(...args),
}));
