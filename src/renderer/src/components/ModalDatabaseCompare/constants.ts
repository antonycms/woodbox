import type {
  DatabaseCompareKind,
  DatabaseCompareMessageCode,
  DatabaseCompareOperation,
  DatabaseCompareOptions as IDatabaseCompareOptions,
} from '@shared/types/databaseCompare';
import { TranslationKey } from '@renderer/stores/I18n/translations';

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

export const KIND_LABEL_KEY: Record<DatabaseCompareKind, TranslationKey> = {
  table: 'databaseCompare.kind.table',
  view: 'databaseCompare.kind.view',
  materialized_view: 'databaseCompare.kind.materializedView',
  column: 'databaseCompare.kind.column',
  primary_key: 'databaseCompare.kind.primaryKey',
  foreign_key: 'databaseCompare.kind.foreignKey',
  unique_key: 'databaseCompare.kind.uniqueKey',
  check: 'databaseCompare.kind.check',
  exclusion: 'databaseCompare.kind.exclusion',
  index: 'databaseCompare.kind.index',
  trigger: 'databaseCompare.kind.trigger',
  rule: 'databaseCompare.kind.rule',
  function: 'databaseCompare.kind.function',
  sequence: 'databaseCompare.kind.sequence',
  owner: 'databaseCompare.kind.owner',
};

export const MESSAGE_LABEL_KEY: Record<DatabaseCompareMessageCode, TranslationKey> = {
  different_dialects: 'databaseCompare.warning.differentDialects',
  column_type_changed: 'databaseCompare.detail.columnTypeChanged',
  column_nullable_changed: 'databaseCompare.detail.columnNullableChanged',
  column_default_changed: 'databaseCompare.detail.columnDefaultChanged',
  object_definition_changed: 'databaseCompare.detail.objectDefinitionChanged',
  owner_changed: 'databaseCompare.detail.ownerChanged',
  selected_objects_equivalent: 'databaseCompare.detail.selectedObjectsEquivalent',
};
