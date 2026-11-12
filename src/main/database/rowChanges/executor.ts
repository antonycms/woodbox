import type { Knex } from 'knex';
import type { DatabaseRow } from '@shared/types/database';
import type { TableRowChangesIntent } from '@shared/types/rowChanges';
import type { DatabaseDialectAdapter } from '../types';
import { executeQueryUpdates } from '../queryUpdates';
import { assertRowChangeIdentifiers } from './metadata';
import { queryTableKey } from '../utils/queryUpdates';
import type { RowChangesPlan } from './planner';

// Same value semantics as generated DML previews: a present undefined is NULL,
// an absent insert key is a default/omission, and objects are JSON values.
const serializeValue = (value: unknown): string | number | boolean | null => {
  if (value === null || value === undefined) return null;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'boolean') return value;
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const executeRowChanges = async (trx: Knex.Transaction, adapter: DatabaseDialectAdapter, plan: RowChangesPlan) => {
  for (const { target } of plan.tables) {
    await adapter.validateQueryUpdateTable?.(trx, target);
  }
  if (plan.kind === 'strict-updates') {
    const metadata = new Map(plan.tables.map(({ target, primaryKey, columns }) => [
      queryTableKey(target), { columns: new Set(columns), primaryKey: primaryKey || [] },
    ] as const));
    const getMetadata = async (table: { schema?: string; table: string }) => {
      const resolved = metadata.get(queryTableKey(table));
      if (!resolved) throw new Error('Não foi possível identificar a tabela das alterações.');
      return resolved;
    };
    await executeQueryUpdates(trx, adapter, plan.updates, getMetadata);
    return;
  }

  const { target } = plan.tables[0];
  const filters = (row: DatabaseRow) => Object.fromEntries(plan.whereColumns.map((column) => {
    if (!Object.hasOwn(row, column)) throw new Error('A identidade original do registro está incompleta.');
    return [column, row[column]];
  }));
  await executeTableRowChanges(trx, adapter, {
    source: { type: 'table', schema: target.schema, table: target.table },
    inserts: plan.inserts,
    updates: plan.updates.map(({ original, changes }) => ({ filters: filters(original), values: changes })),
    deletes: plan.deletes.map(filters),
  }, plan.columnOrder);
};

export const executeTableRowChanges = async (
  trx: Knex.Transaction,
  adapter: DatabaseDialectAdapter,
  intent: TableRowChangesIntent,
  columnOrder?: string[],
) => {
  const target = intent.source;
  assertRowChangeIdentifiers([target.schema, target.table]);
  const quote = adapter.quoteIdentifier;
  const tableName = target.schema ? `${quote(target.schema)}.${quote(target.table)}` : quote(target.table);
  const pending: { sql: string; values: (string | number | boolean | null)[] }[] = [];
  const where = (row: DatabaseRow) => {
    const columns = Object.keys(row);
    if (!columns.length) throw new Error('Não foi possível identificar o registro.');
    assertRowChangeIdentifiers(columns);
    const values: (string | number | boolean | null)[] = [];
    const sql = columns.map((column) => {
      const value = serializeValue(row[column]);
      if (value === null) return `${quote(column)} IS NULL`;
      values.push(value);
      return `${quote(column)} = ?`;
    }).join(' AND ');
    return { sql, values };
  };
  for (const row of intent.deletes) {
    const match = where(row);
    pending.push({ sql: `DELETE FROM ${tableName} WHERE ${match.sql}`, values: match.values });
  }
  // Preserve generated-DML grouping and DELETE -> INSERT -> UPDATE order.
  const groups = new Map<string, { columns: string[]; rows: DatabaseRow[] }>();
  const orderedNames = columnOrder || [...new Set(intent.inserts.flatMap((row) => Object.keys(row)))];
  const orderedSet = new Set(orderedNames);
  for (const row of intent.inserts) {
    assertRowChangeIdentifiers(Object.keys(row));
    const columns = [
      ...orderedNames.filter((name) => Object.hasOwn(row, name)),
      ...Object.keys(row).filter((name) => !orderedSet.has(name)),
    ];
    const key = JSON.stringify(columns);
    const group = groups.get(key);
    if (group) group.rows.push(row);
    else groups.set(key, { columns, rows: [row] });
  }
  for (const { columns, rows } of groups.values()) {
    const batchSize = Math.max(1, Math.floor(adapter.rowChangesInsertBindingBudget / columns.length));
    for (let offset = 0; offset < rows.length; offset += batchSize) {
      const batch = rows.slice(offset, offset + batchSize);
      pending.push({
        sql: `INSERT INTO ${tableName} (${columns.map(quote).join(', ')}) VALUES ${batch.map(() => `(${columns.map(() => '?').join(', ')})`).join(', ')}`,
        values: batch.flatMap((row) => columns.map((column) => serializeValue(row[column]))),
      });
    }
  }
  for (const { filters, values: changes } of intent.updates) {
    assertRowChangeIdentifiers(Object.keys(changes));
    const match = where(filters);
    pending.push({
      sql: `UPDATE ${tableName} SET ${Object.keys(changes).map((column) => `${quote(column)} = ?`).join(', ')} WHERE ${match.sql}`,
      values: [...Object.values(changes).map(serializeValue), ...match.values],
    });
  }
  // Column existence and constraints are checked by the database. Any failure
  // rolls back the whole batch, including statements already executed.
  for (const statement of pending) await trx.raw(statement.sql, statement.values);
};
