import type { QueryRowUpdate } from '../types';
import type {
  DatabaseRow,
  IColumnRestrictionsInfo,
  QueryColumnSource,
  SerializedRunSqlColumn,
} from '@shared/types/database';
import type { RowChange } from '@shared/types/rowChanges';
import { mergeQueryUpdates, queryTableKey } from '../utils/queryUpdates';

export interface QueryEditTarget {
  source: QueryColumnSource;
  primaryKey: { column: string; resultColumn: string }[];
}

export const getQueryEditTargets = (
  columns: SerializedRunSqlColumn[],
  restrictions: Map<string, IColumnRestrictionsInfo[]>,
): Map<string, QueryEditTarget> => {
  const targets = new Map<string, QueryEditTarget>();
  if (new Set(columns.map((column) => column.name)).size !== columns.length) return targets;
  const byTable = new Map<string, Map<string, SerializedRunSqlColumn[]>>();
  for (const column of columns) {
    if (!column.source) continue;
    const key = queryTableKey(column.source);
    let byColumn = byTable.get(key);
    if (!byColumn) byTable.set(key, byColumn = new Map());
    const matches = byColumn.get(column.source.column);
    if (matches) matches.push(column);
    else byColumn.set(column.source.column, [column]);
  }
  const primaryKeys = new Map<string, QueryEditTarget['primaryKey']>();
  for (const [key, byColumn] of byTable) {
    const pk = restrictions.get(key)?.find((restriction) => restriction.constraint_type === 'primary_key')?.column_names;
    if (!pk?.length) continue;
    const primaryKey: QueryEditTarget['primaryKey'] = [];
    for (const name of pk) {
      const matches = byColumn.get(name);
      if (matches?.length !== 1) break;
      primaryKey.push({ column: name, resultColumn: matches[0].name });
    }
    if (primaryKey.length === pk.length) primaryKeys.set(key, primaryKey);
  }
  for (const column of columns) {
    if (!column.source || column.name.startsWith('__')) continue;
    const primaryKey = primaryKeys.get(queryTableKey(column.source));
    if (primaryKey) targets.set(column.name, { source: column.source, primaryKey });
  }
  return targets;
};

export const getQueryRowPrimaryKey = (
  row: DatabaseRow | undefined,
  target?: QueryEditTarget,
): QueryRowUpdate['primaryKey'] | undefined => {
  if (!row || !target) return;
  const entries: [string, string | number | boolean][] = [];
  for (const { column, resultColumn } of target.primaryKey) {
    const value = row[resultColumn];
    if (
      typeof value !== 'string' &&
      typeof value !== 'boolean' &&
      !(typeof value === 'number' && Number.isFinite(value))
    )
      return;
    entries.push([column, value]);
  }
  return entries.length ? Object.fromEntries(entries) : undefined;
};

export const buildQueryUpdates = (
  edits: RowChange[],
  targets: Map<string, QueryEditTarget>,
): { updates: QueryRowUpdate[]; error?: 'unavailable' | 'conflict' } => {
  const updates: QueryRowUpdate[] = [];
  for (const { original: row, changes } of edits) {
    for (const [name, value] of Object.entries(changes)) {
      const target = targets.get(name);
      const primaryKey = getQueryRowPrimaryKey(row, target);
      if (!target || !primaryKey || value === undefined)
        return { updates: [], error: 'unavailable' };
      updates.push({
        schema: target.source.schema,
        table: target.source.table,
        primaryKey,
        changes: { [target.source.column]: value },
      });
    }
  }
  const merged = mergeQueryUpdates(updates);
  return merged.conflict ? { updates: [], error: 'conflict' } : { updates: merged.updates };
};
