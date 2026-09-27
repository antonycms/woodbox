export type DatabaseCompareOperation = 'create' | 'modify' | 'delete' | 'none';

export type DatabaseCompareKind =
  | 'table'
  | 'view'
  | 'materialized_view'
  | 'column'
  | 'primary_key'
  | 'foreign_key'
  | 'unique_key'
  | 'check'
  | 'exclusion'
  | 'index'
  | 'trigger'
  | 'rule'
  | 'function'
  | 'sequence'
  | 'owner';

export interface DatabaseCompareOptions {
  compareTables: boolean;
  comparePrimaryKeys: boolean;
  compareForeignKeys: boolean;
  compareUniqueKeys: boolean;
  compareCheckConstraints: boolean;
  compareExclusionConstraints: boolean;
  compareViews: boolean;
  compareFunctions: boolean;
  compareIndexes: boolean;
  compareSequences: boolean;
  compareTriggers: boolean;
  compareRules: boolean;
  compareOwners: boolean;
  useCascadeDelete: boolean;
  compareSequenceLastValues: boolean;
  compareColumnOrder: boolean;
  ignoreTableNameCase: boolean;
  ignoreColumnNameCase: boolean;
  detectRenames: boolean;
  detectTableRenames: boolean;
  enableRollback: boolean;
}

export interface DatabaseCompareObjectSelection {
  type?: 'table' | 'function';
  schema?: string;
  table?: string;
  name?: string;
  functionIdentityArguments?: string;
}

export interface DatabaseCompareParams {
  sourceConnectionId: string;
  targetConnectionId: string;
  selectedObjects: DatabaseCompareObjectSelection[];
  options: DatabaseCompareOptions;
}

export interface DatabaseCompareItemEndpoint {
  schema?: string;
  name: string;
  parentName?: string;
}

export interface DatabaseCompareItemDisplay {
  schema?: string;
  name?: string;
  parentName?: string;
  targetName?: string;
}

export type DatabaseCompareMessageCode =
  | 'different_dialects'
  | 'column_type_changed'
  | 'column_nullable_changed'
  | 'column_default_changed'
  | 'object_definition_changed'
  | 'owner_changed'
  | 'selected_objects_equivalent';

export interface DatabaseCompareMessage {
  code: DatabaseCompareMessageCode;
  values?: Record<string, string | number>;
}

export interface DatabaseCompareItem {
  id: string;
  operation: DatabaseCompareOperation;
  kind: DatabaseCompareKind;
  label?: string;
  display?: DatabaseCompareItemDisplay;
  source?: DatabaseCompareItemEndpoint;
  target?: DatabaseCompareItemEndpoint;
  ddl?: string;
  rollbackDdl?: string;
  details?: DatabaseCompareMessage[];
}

export interface DatabaseCompareResult {
  items: DatabaseCompareItem[];
  warnings: DatabaseCompareMessage[];
  summary: Record<DatabaseCompareOperation, number>;
}
