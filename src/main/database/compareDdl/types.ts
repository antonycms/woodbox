export type CompareDbObjectType = 'table' | 'view' | 'materialized_view';
export type CompareConstraintType = 'primary_key' | 'unique_key' | 'check' | 'exclusion';

export type CompareColumnInfo = Record<string, unknown> & {
  column_name: string;
  data_type?: string;
  udt_name?: string;
  is_nullable?: boolean;
  column_default?: string;
  is_auto_increment?: boolean;
};

export type CompareRestrictionInfo = Record<string, unknown> & {
  constraint_name: string;
  constraint_type?: CompareConstraintType;
  constraint_definition?: string;
  expression?: string;
};

export type CompareForeignKeyInfo = Record<string, unknown> & {
  constraint_name: string;
};

export type CompareIndexInfo = Record<string, unknown> & {
  index_name: string;
  index_definition?: string;
};

export type CompareTriggerInfo = Record<string, unknown> & {
  trigger_name: string;
};

export type CompareRuleInfo = Record<string, unknown> & {
  rule_name: string;
};

export interface CompareColumnChanges {
  typeChanged: boolean;
  nullableChanged: boolean;
  defaultChanged: boolean;
}

export interface CompareDdlBuilder {
  quoteIdentifier(value: string): string;
  qualifiedName(schema: string | undefined, name: string): string;
  makeColumnType(column: CompareColumnInfo): string;
  makeColumnDefinition(column: CompareColumnInfo): string;
  dropObject(type: CompareDbObjectType, schema: string | undefined, name: string, cascade?: boolean): string;
  addColumn(tableName: string, column: CompareColumnInfo): string;
  dropColumn(tableName: string, columnName: string): string;
  alterColumn(
    tableName: string,
    columnName: string,
    sourceColumn: CompareColumnInfo,
    targetColumn: CompareColumnInfo,
    changes: CompareColumnChanges,
  ): string[];
  addConstraint(tableName: string, row: CompareRestrictionInfo): string;
  dropConstraint(tableName: string, row: CompareRestrictionInfo): string;
  addForeignKey(tableName: string, row: CompareForeignKeyInfo, definition: string): string;
  dropForeignKey(tableName: string, row: CompareForeignKeyInfo): string;
  createIndex(tableName: string, row: CompareIndexInfo): string;
  dropIndex(tableName: string, schema: string | undefined, row: CompareIndexInfo): string;
  dropTrigger(tableName: string, row: CompareTriggerInfo): string;
  dropRule(tableName: string, row: CompareRuleInfo): string;
  dropFunction(schema: string | undefined, name: string, identityArguments: string | undefined, cascade?: boolean): string;
  dropSequence(schema: string | undefined, name: string, cascade?: boolean): string;
}
