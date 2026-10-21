import type { QueryRowUpdate } from '../types/database';

// Knex/drivers interpret question marks as placeholders even inside quoted
// identifiers. Do not let placeholder escaping change the target identity.
export const isQueryUpdateIdentifier = (value: string) => !!value && !/[?\\]/.test(value);

export const queryTableKey = (table: { schema?: string; table: string }) =>
  JSON.stringify([table.schema || '', table.table]);

export const queryRecordKey = (update: Pick<QueryRowUpdate, 'schema' | 'table' | 'primaryKey'>) =>
  JSON.stringify([
    queryTableKey(update),
    Object.entries(update.primaryKey).sort(([a], [b]) => a.localeCompare(b)),
  ]);

export const mergeQueryUpdates = (
  updates: QueryRowUpdate[],
): { updates: QueryRowUpdate[]; conflict?: string } => {
  const merged = new Map<string, QueryRowUpdate>();
  for (const update of updates) {
    const key = queryRecordKey(update);
    const previous = merged.get(key);
    if (!previous) {
      merged.set(key, { ...update, changes: { ...update.changes } });
      continue;
    }
    for (const [column, value] of Object.entries(update.changes)) {
      if (
        Object.hasOwn(previous.changes, column) &&
        JSON.stringify(previous.changes[column]) !== JSON.stringify(value)
      ) {
        return { updates: [], conflict: column };
      }
      previous.changes = { ...previous.changes, [column]: value };
    }
  }
  return { updates: [...merged.values()] };
};
