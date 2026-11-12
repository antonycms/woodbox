import structureDdl from '../structure/ddl/postgres';
import { postgresFilterColumns } from '../tableFilters/columns';
import type { Knex } from 'knex';
import { quoteSqlIdentifier as quoteIdentifier } from '@shared/utils/sql';
import type { DatabaseRow, SerializedRunSqlResult } from '@shared/types/database';
import pg from 'pg';
import queries from '../queries/postgres';
import type { DatabaseDialectAdapter } from '../types';

pg.types.setTypeParser(1114, (val) => val);
pg.types.setTypeParser(1184, (val) => val);

const postgresTypesByOid = new Map<number, string>(
  Object.entries(pg.types.builtins).map(([name, oid]) => [Number(oid), name.toLowerCase()]),
);
const getPostgresTypeName = (oid?: number) => (oid ? postgresTypesByOid.get(oid) : undefined);

const postgres: DatabaseDialectAdapter = {
  structureDdl,
  id: 'postgres',
  indexMethods: ['btree', 'hash', 'gist', 'gin', 'spgist', 'brin'],
  commonColumnTypes: [
    'varchar',
    'text',
    'integer',
    'bigint',
    'serial',
    'bigserial',
    'uuid',
    'boolean',
    'numeric',
    'decimal',
    'date',
    'timestamp',
    'timestamptz',
    'json',
    'jsonb',
  ],
  connectionDescriptor: {
    label: 'PostgreSQL',
    mode: 'network',
    defaultPort: 5432,
    supportsSsl: true,
  },
  client: 'postgres',
  queries,
  queryIdentifierRules: { foldUnquoted: true },
  quoteIdentifier,
  getTableFilterColumns: postgresFilterColumns,
  rowChangesInsertBindingBudget: 60_000,
  resolveRowChangeTable: async (instance, { schema, table }) => {
    const name = schema ? `${quoteIdentifier(schema)}.${quoteIdentifier(table)}` : quoteIdentifier(table);
    const row = await instance('pg_catalog.pg_class as c')
      .join('pg_catalog.pg_namespace as n', 'n.oid', 'c.relnamespace')
      .select('n.nspname as schema', 'c.relname as table')
      .whereRaw('c.oid = to_regclass(?)', [name]).first();
    if (!row) throw new Error('A tabela não existe mais. Atualize os dados antes de salvar.');
    return { schema: String(row.schema), table: String(row.table) };
  },
  getConnectionConfig: (config) => ({
    host: config.host,
    port: config.port,
    user: config.username,
    password: config.password,
    database: config.database,
    dateStrings: true,
    application_name: `Woodbox (${config.description})`,
  }),
  getRows: <Row = DatabaseRow>(raw: unknown): Row[] => (raw as { rows?: Row[] })?.rows || [],
  getExplainSql: (sql) => `EXPLAIN (ANALYZE, BUFFERS, FORMAT JSON) ${sql};`,
  executeQueryUpdate: async (transaction, sql, bindings) => {
    const result: pg.QueryResult = await transaction.raw(sql, bindings);
    return result.rowCount ?? NaN;
  },
  serializeRunSqlResult: (raw, context) => {
    const rawArray = (Array.isArray(raw) ? raw : [raw]) as pg.QueryResult<DatabaseRow>[];

    return rawArray.map<SerializedRunSqlResult>((rawResult) => {
      const { command: type, fields: columns, rowCount: affected_rows, rows = [] } = rawResult;

      return {
        type,
        affected_rows,
        auto_paginated: context.auto_paginated,
        execution_time_ms: context.execution_time_ms,
        rows: JSON.parse(JSON.stringify(rows)),
        columns: columns?.map?.((field) => field.name) || [],
        columns_info: columns?.map?.((field) => ({
          name: field.name,
          type: getPostgresTypeName(field.dataTypeID),
          source_ref: field.tableID && field.columnID ? `${field.tableID}:${field.columnID}` : undefined,
        })),
        column_sources_resolved: true,
      };
    });
  },
  resolveQueryColumnSources: async (instance, columns) => {
    const refs = columns.flatMap((column) => {
      const match = /^(\d+):(\d+)$/.exec(column.source_ref || '');
      if (!match) return [];
      const tableId = Number(match[1]);
      const columnId = Number(match[2]);
      return Number.isInteger(tableId) && tableId > 0 && tableId <= 0xffffffff &&
        Number.isInteger(columnId) && columnId > 0 && columnId <= 32767
        ? [{ tableId, columnId }] : [];
    });
    const tableIds = [...new Set(refs.map((ref) => ref.tableId))];
    if (!tableIds.length) return columns.map((column) => ({ ...column, source: undefined }));

    const raw = await instance
      .select(
        'c.oid as table_id',
        'a.attnum as column_id',
        'n.nspname as schema',
        'c.relname as table',
        'a.attname as column',
      )
      .from('pg_catalog.pg_class as c')
      .join('pg_catalog.pg_namespace as n', 'n.oid', 'c.relnamespace')
      .join('pg_catalog.pg_attribute as a', 'a.attrelid', 'c.oid')
      .whereIn('c.oid', tableIds)
      .whereIn('a.attnum', [...new Set(refs.map((ref) => ref.columnId))])
      .whereIn('c.relkind', ['r', 'p'])
      .where('a.attnum', '>', 0)
      .where('a.attisdropped', false);
    const sources = new Map(
      raw.map((column) => [
        `${column.table_id}:${column.column_id}`,
        { schema: String(column.schema), table: String(column.table), column: String(column.column) },
      ]),
    );

    return columns.map((column) => ({
      ...column,
      source: sources.get(column.source_ref || ''),
    }));
  },
  cancelQuery: async ({ instance, dbConnection }) => {
    await (instance.client as Knex.Client & { cancelQuery(connection: object): Promise<void> }).cancelQuery(dbConnection);
    return true;
  },
};

export default postgres;
