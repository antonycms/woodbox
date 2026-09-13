import type { DatabaseCompareOperation, IDatabaseCompareOptions } from '@renderer/contexts/Store';
import type { TranslationKey } from '@renderer/contexts/I18n';

export const DEFAULT_OPTIONS: IDatabaseCompareOptions = {
  compareTables: true,
  comparePrimaryKeys: true,
  compareForeignKeys: true,
  compareUniqueKeys: true,
  compareCheckConstraints: true,
  compareExclusionConstraints: true,
  compareViews: true,
  compareFunctions: true,
  compareIndexes: true,
  compareSequences: false,
  compareTriggers: true,
  compareRules: true,
  compareOwners: false,
  useCascadeDelete: false,
  compareSequenceLastValues: true,
  compareColumnOrder: false,
  ignoreTableNameCase: false,
  ignoreColumnNameCase: false,
  detectRenames: false,
  detectTableRenames: false,
  enableRollback: false,
};

export const OPERATION_LABEL_KEY: Record<Exclude<DatabaseCompareOperation, 'none'>, TranslationKey> = {
  modify: 'databaseCompare.result.modify',
  create: 'databaseCompare.result.create',
  delete: 'databaseCompare.result.delete',
};
