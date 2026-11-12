import type { Knex } from 'knex';
import type {
  IExportDataParams,
  ExportDataSource as ExportSource,
  IImportTableDataParams,
  IImportTableDataResult,
} from '@shared/types/database';
import { exportRowsToFile } from '../../files/exportData';
import { getConnection } from '../connections';
import { getDialectAdapter } from '../dialects';
import { getExportSql } from '../utils/exportSql';

type IExportPreviewParams = Pick<IExportDataParams, 'source'>;

const readExportRows = async (
  instance: Knex,
  source: ExportSource,
  quoteIdentifier: (value: string) => string,
  options?: { limit?: number; offset?: number },
) => {
  const raw = await instance.raw(getExportSql(source, quoteIdentifier, options));

  return raw;
};

const getSerializedExportResult = (
  adapter: ReturnType<typeof getDialectAdapter>,
  raw: unknown,
  statement: string,
) => {
  const [result] = adapter.serializeRunSqlResult(raw, {
    auto_paginated: false,
    execution_time_ms: 0,
    statement,
  });

  return {
    rows: result?.rows || [],
    columns: result?.columns || Object.keys(result?.rows?.[0] || {}),
  };
};

export const getExportDataPreview = async (
  connectionId: string,
  { source }: IExportPreviewParams,
) => {
  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;
  const adapter = getDialectAdapter(dialect);
  const sql = getExportSql(source, adapter.quoteIdentifier, { limit: 10, offset: 0 });
  const raw = await instance.raw(sql);
  const result = getSerializedExportResult(adapter, raw, sql);

  return {
    columns: result.columns,
    rows: result.rows.slice(0, 10),
  };
};

export const exportData = async (
  connectionId: string,
  { source, columns, format, batchSize = 1000, fileName }: IExportDataParams,
) => {
  if (!columns?.length) throw new Error('Selecione ao menos uma coluna para exportar.');

  const connection = await getConnection(connectionId);
  const { instance, dialect } = connection;
  const adapter = getDialectAdapter(dialect);
  const safeBatchSize = Math.max(1, Math.min(Number(batchSize) || 1000, 100000));
  const readPage = async (page?: number) => {
    const limit = safeBatchSize;
    const offset = page ? (page - 1) * safeBatchSize : 0;
    const sql = getExportSql(source, adapter.quoteIdentifier, { limit, offset });
    const raw = await readExportRows(instance, source, adapter.quoteIdentifier, { limit, offset });
    const { rows } = getSerializedExportResult(adapter, raw, sql);

    return rows as Record<string, unknown>[];
  };

  const eachRowsBatch = async (callback: (rows: Record<string, unknown>[]) => Promise<void>) => {
    let page = 1;
    let totalRows = 0;

    while (true) {
      const rows = await readPage(page);

      if (!rows.length) break;

      totalRows += rows.length;
      await callback(rows);

      if (rows.length < safeBatchSize) break;

      page += 1;
    }

    return totalRows;
  };

  return exportRowsToFile({ columns, format, fileName }, eachRowsBatch);
};

export const importTableData = async (
  connectionId: string,
  { schema, table, rows }: IImportTableDataParams,
): Promise<IImportTableDataResult> => {
  if (!table) throw new Error('Tabela não informada.');

  const rowsToImport = rows.filter((row) => Object.keys(row).length);
  if (!rowsToImport.length) return { insertedRows: 0 };

  const connection = await getConnection(connectionId);
  const { instance } = connection;
  const chunkSize = 500;
  let insertedRows = 0;

  await instance.transaction(async (trx) => {
    for (let index = 0; index < rowsToImport.length; index += chunkSize) {
      const chunk = rowsToImport.slice(index, index + chunkSize);
      const query = schema ? trx.withSchema(schema).table(table) : trx.table(table);

      await query.insert(chunk);
      insertedRows += chunk.length;
    }
  });

  return { insertedRows };
};
