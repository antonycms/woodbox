import type { Knex } from 'knex';
import { quoteSqlIdentifier } from '@shared/utils/sql';
import type { ITableWithSchema } from '../types';
import { executeFilterQuery } from './query';
import { filterTarget, type FilterColumn } from './comparison';

export const postgresFilterColumns = async (instance: Knex, connection: object, target: ITableWithSchema): Promise<FilterColumn[]> => {
  const name = target.schema ? `${quoteSqlIdentifier(target.schema)}.${quoteSqlIdentifier(target.table)}` : quoteSqlIdentifier(target.table);
  const query = instance.raw(`SELECT a.attname AS column_name, t.typname AS data_type,
    t.typname AS udt_name,
    NOT a.attnotnull AS is_nullable,
    CASE WHEN t.typname IN ('varchar','bpchar') AND a.atttypmod >= 4 THEN a.atttypmod - 4 END AS character_maximum_length,
    CASE WHEN t.typname = 'numeric' AND a.atttypmod >= 4 THEN ((a.atttypmod - 4) >> 16) & 65535 END AS numeric_precision,
    CASE WHEN t.typname = 'numeric' AND a.atttypmod >= 4 THEN (a.atttypmod - 4) & 65535 END AS numeric_scale
    FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_type t ON t.oid=a.atttypid
    WHERE a.attrelid=pg_catalog.to_regclass(?) AND a.attnum>0 AND NOT a.attisdropped ORDER BY a.attnum`, [name]);
  const { raw } = await executeFilterQuery(instance, connection, query);
  if (!raw || typeof raw !== 'object' || !('rows' in raw) || !Array.isArray(raw.rows)) throw new Error('Metadados inválidos do PostgreSQL.');
  return raw.rows;
};
export const mysqlFilterColumns = async (instance: Knex, connection: object, target: ITableWithSchema): Promise<FilterColumn[]> => {
  const query = instance.raw('SHOW FULL COLUMNS FROM ??', [instance.raw(filterTarget('mysql', target))]);
  const { raw } = await executeFilterQuery(instance, connection, query);
  if (!Array.isArray(raw) || !Array.isArray(raw[0])) throw new Error('Metadados inválidos do MySQL.');
  return raw[0].map((row: Record<string, unknown>): FilterColumn => ({
    column_name: String(row.Field), data_type: String(row.Type).replace(/\(.*/, '').replace(/ unsigned$/, ''),
    udt_name: String(row.Type), is_nullable: row.Null === 'YES',
    description: typeof row.Comment === 'string' ? row.Comment : undefined,
  }));
};
export const sqliteFilterColumns = async (instance: Knex, connection: object, target: ITableWithSchema): Promise<FilterColumn[]> => {
  const args = target.schema ? [target.table, target.schema] : [target.table];
  const query = instance.raw(`SELECT * FROM pragma_table_xinfo(${args.map(() => '?').join(',')})`, args);
  const { raw } = await executeFilterQuery(instance, connection, query);
  if (!Array.isArray(raw)) throw new Error('Metadados inválidos do SQLite.');
  const columns = raw.map((row: Record<string, unknown>): FilterColumn => ({
    column_name: String(row.name), data_type: String(row.type || '').toLowerCase(),
    udt_name: String(row.type || '').toLowerCase(), is_nullable: !row.notnull && !row.pk, presentationHidden: Number(row.hidden) !== 0,
  }));
  return columns;
};
