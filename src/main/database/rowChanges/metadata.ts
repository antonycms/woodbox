import type { Knex } from 'knex';
import type { IColumnInfo, IColumnRestrictionsInfo } from '@shared/types/database';
import { isQueryUpdateIdentifier, queryTableKey } from '../utils/queryUpdates';
import type { DatabaseDialectAdapter, ITableWithSchema } from '../types';

export interface RowChangeMetadata {
  columns: Set<string>;
  primaryKey: string[];
}

export const assertRowChangeIdentifiers = (names: (string | undefined)[]) => {
  if (names.some((name) => name !== undefined && !isQueryUpdateIdentifier(name))) {
    throw new Error('Os identificadores dessas alterações não são suportados para edição segura.');
  }
};

export const getPrimaryKey = async (instance: Knex, adapter: DatabaseDialectAdapter, table: ITableWithSchema) => {
  const restrictions = adapter.getRows<IColumnRestrictionsInfo>(
    await instance.raw(adapter.queries.getTableRestrictions(table)),
  );
  return restrictions.find((restriction) => restriction.constraint_type === 'primary_key')?.column_names || [];
};

export const getColumnNames = async (instance: Knex, adapter: DatabaseDialectAdapter, table: ITableWithSchema) => {
  const columns = adapter.getRows<IColumnInfo>(await instance.raw(adapter.queries.getTableColumns(table)));
  return columns.map((column) => column.column_name);
};

export const createRowChangeMetadata = (trx: Knex.Transaction, adapter: DatabaseDialectAdapter) => {
  const cache = new Map<string, Promise<RowChangeMetadata>>();
  return (table: ITableWithSchema) => {
    const key = queryTableKey(table);
    let pending = cache.get(key);
    if (!pending) {
      pending = (async () => {
        assertRowChangeIdentifiers([table.schema, table.table]);
        await adapter.validateQueryUpdateTable?.(trx, table);
        const columns = await getColumnNames(trx, adapter, table);
        const primaryKey = await getPrimaryKey(trx, adapter, table);
        assertRowChangeIdentifiers(primaryKey);
        return { columns: new Set(columns), primaryKey };
      })();
      cache.set(key, pending);
    }
    return pending;
  };
};

export type RowChangeMetadataLoader = ReturnType<typeof createRowChangeMetadata>;
