import type { Knex } from 'knex';
import { quoteSqlIdentifier } from '@shared/utils/sql';
import type { ITableWithSchema } from '../types';
import { executeFilterQuery } from './query';
import { filterTarget, filterIdentifier, sqliteFilterAffinity, type FilterColumn } from './comparison';

export const postgresFilterColumns = async (instance: Knex, connection: object, target: ITableWithSchema): Promise<FilterColumn[]> => {
  const name = target.schema ? `${quoteSqlIdentifier(target.schema)}.${quoteSqlIdentifier(target.table)}` : quoteSqlIdentifier(target.table);
  const query = instance.raw(`SELECT a.attname AS column_name, t.typname AS data_type,
    t.typname AS udt_name,
    CASE WHEN nt.nspname = 'pg_catalog' AND t.typtype = 'b' THEN t.typname ELSE 'unsupported' END AS comparison_type, NOT a.attnotnull AS is_nullable,
    CASE WHEN t.typname IN ('varchar','bpchar') AND a.atttypmod >= 4 THEN a.atttypmod - 4 END AS character_maximum_length,
    CASE WHEN t.typname = 'numeric' AND a.atttypmod >= 4 THEN ((a.atttypmod - 4) >> 16) & 65535 END AS numeric_precision,
    CASE WHEN t.typname = 'numeric' AND a.atttypmod >= 4 THEN (a.atttypmod - 4) & 65535 END AS numeric_scale,
    CASE WHEN c.oid IS NOT NULL THEN pg_catalog.format('%I.%I', nc.nspname, c.collname) END AS comparison_collation
    FROM pg_catalog.pg_attribute a JOIN pg_catalog.pg_type t ON t.oid=a.atttypid
    JOIN pg_catalog.pg_namespace nt ON nt.oid=t.typnamespace
    LEFT JOIN pg_catalog.pg_collation c ON c.oid=a.attcollation
    LEFT JOIN pg_catalog.pg_namespace nc ON nc.oid=c.collnamespace
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
    udt_name: String(row.Type), is_nullable: row.Null === 'YES', comparison_collation: typeof row.Collation === 'string' ? row.Collation : undefined,
    description: typeof row.Comment === 'string' ? row.Comment : undefined,
  }));
};
export const sqliteFilterColumns = async (instance: Knex, connection: object, target: ITableWithSchema, columnName?: string): Promise<FilterColumn[]> => {
  const args = target.schema ? [target.table, target.schema] : [target.table];
  const query = instance.raw(`SELECT * FROM pragma_table_xinfo(${args.map(() => '?').join(',')})`, args);
  const { raw } = await executeFilterQuery(instance, connection, query);
  if (!Array.isArray(raw)) throw new Error('Metadados inválidos do SQLite.');
  const columns = raw.map((row: Record<string, unknown>): FilterColumn => ({
    column_name: String(row.name), data_type: String(row.type || '').toLowerCase(),
    udt_name: String(row.type || '').toLowerCase(), is_nullable: !row.notnull && !row.pk, presentationHidden: Number(row.hidden) !== 0,
  }));
  const selected = columns.find((column) => column.column_name === columnName);
  if (selected && sqliteFilterAffinity(selected.udt_name || '') === 'text') {
    // Resolve the actual comparison collation, including views, without reading rows
    // or fingerprinting unrelated CREATE TABLE text. Unknown opcode layouts fail closed.
    const builder = instance.select(instance.raw('?? = ?', [instance.raw(filterIdentifier('sqlite', selected.column_name)), '']))
      .from(instance.raw(filterTarget('sqlite', target))).limit(1);
    const explained = (await executeFilterQuery(instance, connection, builder, true)).raw;
    if (Array.isArray(explained)) {
      const variables = explained.filter((row) => row && row.opcode === 'Variable' && row.p1 === 1);
      const register = variables.length === 1 ? variables[0].p2 : undefined;
      const comparisons = register === undefined ? [] : explained.filter((row) => row && ['Eq', 'Ne'].includes(row.opcode)
        && (row.p1 === register || row.p3 === register));
      const collations = new Set(comparisons.map((row) => typeof row.p4 === 'string' ? row.p4 : undefined));
      if (collations.size === 1 && !collations.has(undefined)) selected.comparison_collation = [...collations][0];
    }
  }
  return columns;
};
