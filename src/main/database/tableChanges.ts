import { isDeepStrictEqual } from 'util';
import type { Knex } from 'knex';
import type {
  IApplyTableChangesParams,
  IApplyTableChangesResult,
  ITableDataConflict,
  ITableRowChange,
} from '../../preload/database';

const normalize = (value: unknown): unknown => {
  // Electron transports driver Buffers as Uint8Arrays.
  if (value instanceof Uint8Array) return Array.from(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalize);
  if (value && typeof value === 'object') {
    return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, normalize(item)]));
  }
  return value;
};

const binding = (value: unknown): Knex.Value => {
  if (value === undefined) throw new Error('Valor de coluna não informado.');
  if (value === null) return null;
  if (value instanceof Uint8Array) return Buffer.from(value);
  if (value instanceof Date) return value;
  if (typeof value === 'object') return JSON.stringify(value);
  if (typeof value === 'bigint') return String(value);
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean')
    return value;
  throw new Error('Valor de coluna inválido.');
};

class TableConflictError extends Error {
  readonly conflicts: ITableDataConflict[];

  constructor(conflicts: ITableDataConflict[]) {
    super('Os registros foram alterados desde o carregamento.');
    this.conflicts = conflicts;
  }
}

export const applyTableChanges = async (
  instance: Knex,
  dialect: Dialect,
  params: IApplyTableChangesParams,
): Promise<IApplyTableChangesResult> => {
  const { schema, table, keyColumns, inserts, updates, deletes } = params;
  if (!table || ((updates.length || deletes.length) && !keyColumns.length)) {
    throw new Error('Tabela ou colunas de identificação não informadas.');
  }

  if (dialect === 'mysql') {
    const [tables] = await instance.raw(
      'SELECT ENGINE FROM information_schema.TABLES WHERE TABLE_SCHEMA = COALESCE(?, DATABASE()) AND TABLE_NAME = ?',
      [schema || null, table],
    );
    if (tables[0]?.ENGINE?.toLowerCase() !== 'innodb') {
      throw new Error('O salvamento com detecção de conflitos requer uma tabela InnoDB.');
    }
  }

  try {
    await instance.transaction(async (trx) => {
      const query = () => (schema ? trx.withSchema(schema).table(table) : trx.table(table));
      const identify = (change: ITableRowChange) => {
        const builder = query();
        for (const column of keyColumns) {
          if (!Object.hasOwn(change.original, column))
            throw new Error('Identificação do registro incompleta.');
          const value = binding(change.original[column]);
          if (value === null) builder.whereNull(column);
          else builder.where(column, value);
        }
        return builder;
      };
      const conflicts: ITableDataConflict[] = [];

      // Lock before comparing, and keep the locks until every change has committed.
      for (const change of [...deletes, ...updates]) {
        const select = identify(change).select('*').limit(2);
        if (dialect === 'postgres' || dialect === 'mysql') select.forUpdate();
        const rows: Record<string, unknown>[] = await select;
        if (rows.length !== 1) {
          conflicts.push({ ...change, reason: rows.length ? 'ambiguous' : 'missing' });
        } else if (!isDeepStrictEqual(normalize(rows[0]), normalize(change.original))) {
          conflicts.push({ ...change, current: rows[0], reason: 'changed' });
        }
      }
      if (conflicts.length) throw new TableConflictError(conflicts);

      for (const change of deletes) {
        const affected = await identify(change).delete();
        if (affected !== 1) throw new TableConflictError([{ ...change, reason: 'missing' }]);
      }
      for (const row of inserts) {
        if (Object.keys(row).length) {
          await query().insert(
            Object.fromEntries(Object.entries(row).map(([key, value]) => [key, binding(value)])),
          );
        }
      }
      for (const change of updates) {
        if (!change.changes || !Object.keys(change.changes).length) continue;
        const affected = await identify(change).update(
          Object.fromEntries(
            Object.entries(change.changes).map(([key, value]) => [key, binding(value)]),
          ),
        );
        if (affected !== 1) throw new TableConflictError([{ ...change, reason: 'missing' }]);
      }
    });
    return { conflicts: [] };
  } catch (error) {
    if (error instanceof TableConflictError) return { conflicts: error.conflicts };
    throw error;
  }
};
