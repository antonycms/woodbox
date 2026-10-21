import type { Knex } from 'knex';
import type { IResolveQueryResultColumnsParams } from '@shared/types/database';
import type { DatabaseDialectAdapter } from './types';
import { getFlatSelectTables, restrictQueryColumnSources } from './utils/querySources';

// Called only when saving edited results. Never execute the user's SELECT again.
export const resolveQueryResultColumns = async (
  instance: Knex,
  adapter: DatabaseDialectAdapter,
  { sql, columns }: IResolveQueryResultColumnsParams,
) => {
  const canResolve =
    !!getFlatSelectTables(sql, adapter.queryIdentifierRules) &&
    new Set(columns.map((column) => column.name)).size === columns.length;
  const resolved =
    canResolve && adapter.resolveQueryColumnSources
      ? await adapter.resolveQueryColumnSources(instance, columns)
      : columns;
  return (
    restrictQueryColumnSources(
      sql,
      {
        type: 'SELECT',
        rows: [],
        columns: columns.map((column) => column.name),
        columns_info: resolved,
        column_sources_resolved: true,
      },
      adapter.queryIdentifierRules,
    ).columns_info || []
  );
};
