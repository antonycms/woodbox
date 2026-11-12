import type { IColumnInfo } from '@shared/types/database';

export interface NewColumnDraft {
  column_name: string;
  data_type: string;
  column_default: string;
  description: string;
  required: boolean;
  is_primary_key: boolean;
  is_unique: boolean;
  is_auto_increment: boolean;
  is_foreign_key: boolean;
}

export type PreparedColumnDraft =
  | { status: 'ready'; defaultIndexMethod: string; column: IColumnInfo; constraintType?: 'primary_key' | 'unique_key' }
  | { status: 'incomplete' }
  | { status: 'blocked'; reason: 'unique-default' | 'auto-type' | 'auto-needs-key' };

export type ColumnToggle = { type: 'toggle-primary-key' | 'toggle-unique' | 'toggle-auto-increment'; checked: boolean };

export interface NewColumnFormData extends NewColumnDraft {
  is_index: boolean;
  reference_table: string;
  reference_column_name: string;
}

