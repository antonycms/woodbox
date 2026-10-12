import type { DatabaseObjectType as DbObjectType, ConstraintType } from '@shared/types/database';
import type { IConnection } from '../types';

export type ConnectionGetter = (connectionId: string) => Promise<IConnection>;
export type Row = Record<string, unknown>;

export type ColumnInfo = Row & {
  column_name: string;
  data_type?: string;
  udt_name?: string;
  is_nullable?: boolean;
  column_default?: string;
  is_auto_increment?: boolean;
};

export type RestrictionInfo = Row & {
  constraint_name: string;
  constraint_type?: ConstraintType;
  constraint_definition?: string;
  column_names?: string[] | string;
  expression?: string;
};

export type ReferenceInfo = Row & {
  constraint_name: string;
  column_name: string;
  reference_table_schema?: string;
  reference_table_name: string;
  reference_column_name: string;
  constraint_definition?: string;
  constraint_order?: number | string;
  remove_rule?: string;
  update_rule?: string;
};

export type ForeignKeyInfo = Row & {
  constraint_name: string;
  column_names: string[];
  reference_table_schema?: string;
  reference_table_name: string;
  reference_column_names: string[];
  constraint_definition?: string;
  remove_rule?: string;
  update_rule?: string;
};

export type IndexInfo = Row & {
  index_name: string;
  index_method?: string;
  is_unique?: boolean;
  is_primary?: boolean;
  column_names?: string[] | string;
  column_orders?: string[] | string;
  expression?: string;
  predicate?: string;
  index_definition?: string;
};

export type TriggerInfo = Row & { trigger_name: string; trigger_definition?: string };
export type RuleInfo = Row & { rule_name: string; rule_definition?: string };

export type FunctionInfo = Row & {
  function_schema?: string;
  function_name: string;
  function_identity_arguments?: string;
  definition?: string;
  owner_name?: string;
};

export type SequenceInfo = Row & {
  sequence_schema?: string;
  sequence_name: string;
  sequence_definition?: string;
  owner_name?: string;
  last_value?: unknown;
};

export type TableInfo = Row & {
  table_schema?: string;
  table_name: string;
  object_type?: DbObjectType;
  definition?: string;
  owner_name?: string;
  columns?: ColumnInfo[];
  restrictions?: RestrictionInfo[];
  references?: ReferenceInfo[];
  indexes?: IndexInfo[];
  triggers?: TriggerInfo[];
  rules?: RuleInfo[];
};

export type Snapshot = {
  connection: IConnection;
  tables: Map<string, TableInfo>;
  functions: Map<string, FunctionInfo>;
  sequences: Map<string, SequenceInfo>;
};

