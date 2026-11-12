import type { Dialect } from './connections';
import type { IColumnInfo, IColumnReferenceInfo, IColumnRestrictionsInfo, IIndexInfo } from './database';

export type StructureColumn = Omit<IColumnInfo, 'is_nullable_label' | 'is_auto_increment_label' | 'display_type' | 'auto_increment_eligible'>;
export type StructureRestriction = Pick<IColumnRestrictionsInfo,
  'constraint_name' | 'constraint_type' | 'constraint_definition' | 'column_names' | 'expression' | 'comment'>;
export type StructureReference = Pick<IColumnReferenceInfo,
  'constraint_name' | 'column_name' | 'reference_table_schema' | 'reference_table_name' |
  'reference_column_name' | 'constraint_definition' | 'comment'>;
export type StructureIndex = Pick<IIndexInfo,
  'index_name' | 'index_method' | 'column_names' | 'column_orders' | 'is_unique' | 'is_primary'>;
export interface StructureColumnChange { original: StructureColumn; current: StructureColumn }
export interface StructureChanges {
  columns: StructureColumn[];
  indexes?: StructureIndex[];
  restrictions?: StructureRestriction[];
  references?: StructureReference[];
  tableComment?: string;
}
export interface StructureAlterChanges extends StructureChanges {
  droppedColumns?: StructureColumn[];
  changedColumns?: StructureColumnChange[];
  droppedIndexes?: StructureIndex[];
  droppedRestrictions?: StructureRestriction[];
  droppedReferences?: StructureReference[];
  existingColumns?: StructureColumn[];
  existingRestrictions?: StructureRestriction[];
  existingReferences?: StructureReference[];
  newTableName?: string;
  tableCommentChanged?: boolean;
}
type Context = { policyId: Dialect; target: { schema?: string; table: string } };
export type PrepareStructureDdlRequest =
  | (Context & { type: 'create-table'; changes: StructureChanges })
  | (Context & { type: 'alter-table'; changes: StructureAlterChanges })
  | (Context & { type: 'add-columns'; columns: StructureColumn[]; references: StructureReference[]; restrictions: StructureRestriction[] })
  | (Context & { type: 'references'; references: (StructureReference & { source: 'loaded' | 'draft' })[] })
  | (Context & { type: 'restrictions'; restrictions: (StructureRestriction & { source: 'loaded' | 'draft' })[] });
export interface StructureDdlDiagnostic {
  code: 'unsupported-operation' | 'missing-definition' | 'incomplete-intent';
  object: 'table' | 'column' | 'index' | 'restriction' | 'reference' | 'trigger';
  name: string;
  operation: 'create' | 'alter' | 'drop' | 'comment' | 'definition';
  field?: 'name' | 'type' | 'nullable' | 'default' | 'auto-increment' | 'comment' | 'constraint' | 'index' | 'definition';
}
export type PreparedStructureDdl =
  | { status: 'ready'; sql: string }
  | { status: 'empty' }
  | { status: 'blocked'; diagnostics: [StructureDdlDiagnostic, ...StructureDdlDiagnostic[]] };
