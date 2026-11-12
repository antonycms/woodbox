import type { DatabaseRow, SerializedRunSqlColumn } from './database';

export type RowChangesSource =
  | { type: 'query'; sql: string; columns: SerializedRunSqlColumn[] }
  | { type: 'table'; schema?: string; table: string };

export interface RowChange {
  original: DatabaseRow;
  changes: DatabaseRow;
}

export interface QueryRowChangesIntent {
  source: Extract<RowChangesSource, { type: 'query' }>;
  inserts: DatabaseRow[];
  updates: RowChange[];
  deletes: DatabaseRow[];
}

export interface TableRowChangesIntent {
  source: Extract<RowChangesSource, { type: 'table' }>;
  inserts: DatabaseRow[];
  updates: { filters: DatabaseRow; values: DatabaseRow }[];
  deletes: DatabaseRow[];
}

export type RowChangesIntent = QueryRowChangesIntent | TableRowChangesIntent;

export type RowChangesRejection =
  | 'unavailable'
  | 'conflict'
  | 'update-only'
  | 'no-primary-key'
  | 'missing-primary-key';

export type SaveRowChangesResult =
  | { status: 'saved' }
  | { status: 'empty' }
  | { status: 'rejected'; reason: RowChangesRejection; table?: string; column?: string };
