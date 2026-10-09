import type { ExportDataSource as ExportSource } from '@shared/types/database';
import { serializeOrderBy } from './orderBy';
import { hasSqlStatementSeparator, isReadOnlySelectQuery } from './sql';

const getExportSourceBaseSql = (
  source: ExportSource,
  quoteIdentifier: (value: string) => string,
) => {
  if (source.type === 'table') {
    const tableName = source.schema
      ? `${quoteIdentifier(source.schema)}.${quoteIdentifier(source.table)}`
      : quoteIdentifier(source.table);
    const whereQuery = source.where ? `WHERE ${source.where}` : '';

    return `SELECT * FROM ${tableName} ${whereQuery}`.trim();
  }

  const sql = source.sql.trim().replace(/;+\s*$/, '');

  if (!isReadOnlySelectQuery(sql)) {
    throw new Error('A exportação só está disponível para consultas SELECT.');
  }

  if (hasSqlStatementSeparator(sql)) {
    throw new Error('Exporte uma instrução SELECT por vez.');
  }

  return `SELECT * FROM (${sql}) AS __export_query`;
};

const getExportSourceOrderBy = (
  source: ExportSource,
  quoteIdentifier: (value: string) => string,
) => serializeOrderBy(source.orderBy, quoteIdentifier);

export const getExportSql = (
  source: ExportSource,
  quoteIdentifier: (value: string) => string,
  options?: { limit?: number; offset?: number },
) => {
  const baseSql = getExportSourceBaseSql(source, quoteIdentifier);
  const orderBy = getExportSourceOrderBy(source, quoteIdentifier);
  const limit = options?.limit;
  const offset = options?.offset ?? 0;
  const pagination = Number(limit) > 0 ? `LIMIT ${Number(limit)} OFFSET ${offset}` : '';

  return [baseSql, orderBy, pagination].filter(Boolean).join('\n');
};
