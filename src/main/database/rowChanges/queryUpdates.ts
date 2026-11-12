import type { Knex } from 'knex';
import {
  isQueryUpdateIdentifier,
  mergeQueryUpdates,
} from '../utils/queryUpdates';
import type { DatabaseDialectAdapter, QueryRowUpdate } from '../types';
import { createRowChangeMetadata, type RowChangeMetadataLoader } from './metadata';

const serializeValue = (value: unknown): string | number | boolean | null => {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return value;
  if (typeof value === 'number' && Number.isFinite(value)) return value;
  if (typeof value === 'object') return JSON.stringify(value);
  throw new Error('Valor inválido para atualização.');
};

export const executeQueryUpdates = async (
  trx: Knex.Transaction,
  adapter: DatabaseDialectAdapter,
  updates: QueryRowUpdate[],
  getMetadata: RowChangeMetadataLoader = createRowChangeMetadata(trx, adapter),
): Promise<void> => {
  if (
    updates.some((update) =>
      [
        update.schema,
        update.table,
        ...Object.keys(update.primaryKey),
        ...Object.keys(update.changes),
      ].some((name) => name !== undefined && !isQueryUpdateIdentifier(name)),
    )
  ) {
    throw new Error('Os identificadores dessas alterações não são suportados para edição segura.');
  }
  const merged = mergeQueryUpdates(updates);
  if (merged.conflict)
    throw new Error(
      `Há alterações conflitantes para a coluna "${merged.conflict}" do mesmo registro.`,
    );
  if (!merged.updates.length) return;

  const pending: {
    sql: string;
    values: (string | number | boolean | null)[];
    tableName: string;
    where: string;
    keys: (string | number | boolean)[];
  }[] = [];
  let changesPrimaryKey = false;
  for (const update of merged.updates) {
    const tableInfo = await getMetadata(update);
    const keyColumns = Object.keys(update.primaryKey);
    if (
      !tableInfo.primaryKey.length ||
      keyColumns.length !== tableInfo.primaryKey.length ||
      tableInfo.primaryKey.some(
        (column) =>
          !Object.hasOwn(update.primaryKey, column) || update.primaryKey[column] == null,
      )
    ) {
      throw new Error('Não foi possível identificar o registro pela chave primária completa.');
    }
    const changes = Object.entries(update.changes);
    if (
      !changes.length ||
      changes.some(([column, value]) => !tableInfo.columns.has(column) || value === undefined)
    ) {
      throw new Error('As alterações contêm colunas ou valores inválidos.');
    }

    const quote = adapter.quoteIdentifier;
    const tableName = update.schema
      ? `${quote(update.schema)}.${quote(update.table)}`
      : quote(update.table);
    const where = tableInfo.primaryKey.map((column) => `${quote(column)} = ?`).join(' AND ');
    const bindings = tableInfo.primaryKey.map((column) => update.primaryKey[column]);
    changesPrimaryKey ||= tableInfo.primaryKey.some((column) =>
      Object.hasOwn(update.changes, column),
    );

    const assignments = changes.map(([column]) => `${quote(column)} = ?`).join(', ');
    pending.push({
      sql: `UPDATE ${tableName} SET ${assignments} WHERE ${where}`,
      values: [...changes.map(([, value]) => serializeValue(value)), ...bindings],
      tableName,
      where,
      keys: bindings,
    });
  }

  const needsIdentityCheck = changesPrimaryKey && pending.length > 1;
  // Only PK-changing batches need to lock every original identity up front:
  // an earlier update must not create a target for a later, stale identity.
  if (needsIdentityCheck) {
    for (const update of pending) {
      const original = await trx
        .select(trx.raw('1'))
        .from(trx.raw(update.tableName))
        .whereRaw(update.where, update.keys)
        .forUpdate();
      if (original.length !== 1) {
        throw new Error('O registro não existe mais. Atualize a consulta antes de salvar.');
      }
    }
  }

  for (const update of pending) {
    const affectedRows = await adapter.executeQueryUpdate(trx, update.sql, update.values);
    if (!Number.isInteger(affectedRows) || affectedRows < 0) {
      throw new Error(
        'Não foi possível confirmar quantos registros foram atualizados. O lote foi cancelado.',
      );
    }
    if (affectedRows > 1) {
      throw new Error('A alteração afetou mais de um registro. O lote foi cancelado.');
    }
    if (affectedRows === 0) {
      throw new Error(
        needsIdentityCheck
          ? 'A identidade de um registro mudou durante o salvamento ou a atualização foi impedida. O lote foi cancelado.'
          : 'O registro não existe mais ou a atualização foi impedida. Atualize a consulta antes de salvar.',
      );
    }
  }
};
