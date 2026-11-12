import type { Knex } from 'knex';
import type { DatabaseRow, SerializedRunSqlColumn } from '@shared/types/database';
import type { SaveRowChangesResult, RowChange, QueryRowChangesIntent } from '@shared/types/rowChanges';
import { queryTableKey } from '../utils/queryUpdates';
import type { DatabaseDialectAdapter, QueryRowUpdate, RowChangeTableIdentity } from '../types';
import { resolveQueryResultColumns } from '../queryResultColumns';
import { restrictQueryColumnSources } from '../utils/querySources';
import { assertRowChangeIdentifiers, getPrimaryKey } from './metadata';
import { buildQueryUpdates, getQueryEditTargets } from './queryTargets';

export interface PlannedTable {
  target: RowChangeTableIdentity;
  primaryKey?: string[];
  columns?: string[];
}

export type RowChangesPlan =
  | { kind: 'strict-updates'; tables: PlannedTable[]; updates: QueryRowUpdate[] }
  | {
      kind: 'table-rows'; tables: [PlannedTable]; whereColumns: string[];
      inserts: DatabaseRow[]; updates: RowChange[]; deletes: DatabaseRow[]; columnOrder?: string[];
    };

type Rejection = Extract<SaveRowChangesResult, { status: 'rejected' }>;
type PlanningResult = { plan: RowChangesPlan } | { result: Rejection | { status: 'empty' } };
const reject = (reason: Rejection['reason'], extra?: Pick<Rejection, 'table' | 'column'>): PlanningResult =>
  ({ result: { status: 'rejected', reason, ...extra } });

export const planRowChanges = async (
  instance: Knex,
  adapter: DatabaseDialectAdapter,
  intent: QueryRowChangesIntent,
): Promise<PlanningResult> => {
  const inserts = intent.inserts.filter((row) => Object.keys(row).length);
  const updates = intent.updates.filter((row) => Object.keys(row.changes).length);
  const deletes = intent.deletes;
  if (!inserts.length && !updates.length && !deletes.length) return { result: { status: 'empty' } };
  const { source } = intent;
  let table: { schema?: string; table: string };

  const classified = restrictQueryColumnSources(source.sql, {
    type: 'SELECT', rows: [], columns: source.columns.map((column) => column.name),
    columns_info: source.columns,
    column_sources_resolved: source.columns.some((column) => column.source || column.source_ref),
  }, adapter.queryIdentifierRules);
  if (classified.supports_row_management && classified.row_management_table) {
    table = classified.row_management_table;
    if (!table.schema && source.columns.some((column) => column.source_ref)) {
      const resolved = await resolveQueryResultColumns(instance, adapter, source);
      const origin = resolved[0]?.source;
      if (!origin || !resolved.every((column) => column.source?.table === origin.table &&
        column.source.schema === origin.schema && column.name === column.source.column)) return reject('unavailable');
      table = origin;
    }
  } else {
    if (inserts.length || deletes.length) return reject('update-only');
    const columns = await resolveQueryResultColumns(instance, adapter, source);
    const changed = new Set(updates.flatMap((row) => Object.keys(row.changes)));
    const targets = new Map<string, PlannedTable>();
    for (const column of columns) {
      if (!changed.has(column.name) || !column.source) continue;
      const key = queryTableKey(column.source);
      if (targets.has(key)) continue;
      assertRowChangeIdentifiers([column.source.schema, column.source.table]);
      const target = await adapter.resolveRowChangeTable(instance, column.source);
      const primaryKey = await getPrimaryKey(instance, adapter, target);
      targets.set(key, { target, primaryKey, columns: columns.flatMap((item) =>
        item.source && queryTableKey(item.source) === key ? [item.source.column] : []) });
    }
    const canonical: SerializedRunSqlColumn[] = columns.map((column) => {
      const target = column.source && targets.get(queryTableKey(column.source))?.target;
      return target && column.source ? { ...column, source: { ...column.source, schema: target.schema, table: target.table } } : column;
    });
    const restrictions = new Map([...targets.values()].map(({ target, primaryKey }) => [
      queryTableKey(target), [{ constraint_name: '', constraint_type: 'primary_key' as const, column_names: primaryKey }],
    ]));
    const built = buildQueryUpdates(updates, getQueryEditTargets(canonical, restrictions));
    if (built.error) return reject(built.error);
    return { plan: { kind: 'strict-updates', tables: [...targets.values()], updates: built.updates } };
  }

  assertRowChangeIdentifiers([table.schema, table.table]);
  const target = await adapter.resolveRowChangeTable(instance, table);
  let primaryKey: string[] | undefined;
  let whereColumns: string[] = [];
  if (updates.length || deletes.length) {
    primaryKey = await getPrimaryKey(instance, adapter, target);
    whereColumns = primaryKey;
    if (!primaryKey.length) {
      return reject('no-primary-key', { table: [target.schema, target.table].filter(Boolean).join('.') });
    }
    if (!whereColumns.length) return reject('unavailable');
    const affected = [...deletes, ...updates.map((row) => row.original)];
    for (const column of whereColumns) {
      if (affected.some((row) =>
        !Object.hasOwn(row, column) || row[column] == null)) {
        return reject('missing-primary-key', { column });
      }
    }
  }
  return { plan: {
    kind: 'table-rows', tables: [{ target, primaryKey }], whereColumns, inserts, updates, deletes,
    columnOrder: source.columns.map((column) => column.name),
  } };
};
