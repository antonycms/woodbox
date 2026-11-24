import type {
  IExportDataParams,
  IExportProgress,
  IImportTableDataParams,
  IImportProgress,
  IImportTableDataResult,
} from '@shared/types/database';
import { exportRowsToFile } from '../../files/exportData';
import { getConnection } from '../connections';
import { getDialectAdapter } from '../dialects';
import { emitEvent } from '../../utils/emitEvent';
import { ExportCanceledError } from '../../files/exportData/cancellation';
import { getExportSql } from '../utils/exportSql';

type IExportPreviewParams = Pick<IExportDataParams, 'source'>;

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

const activeExports = new Map<string, { connectionId: string; canceled: boolean; publishing: boolean }>();

export const cancelExport = (connectionId: string, exportId: string) => {
  const job = activeExports.get(exportId);
  if (!job || job.connectionId !== connectionId || job.publishing) return false;
  job.canceled = true;
  return true;
};

export const exportData = async (
  connectionId: string,
  { source, columns, format, batchSize = 1000, fileName, exportId }: IExportDataParams,
) => {
  if (!columns?.length) throw new Error('Selecione ao menos uma coluna para exportar.');
  if (!exportId || activeExports.has(exportId)) throw new Error('Exportação inválida.');

  // Register before the first await, including connection acquisition.
  const job = { connectionId, canceled: false, publishing: false };
  activeExports.set(exportId, job);
  let rows = 0;
  const checkCanceled = () => {
    if (job.canceled) throw new ExportCanceledError();
  };
  const beginPublishing = () => {
    checkCanceled();
    job.publishing = true;
  };
  const report = (phase: IExportProgress['phase']) =>
    emitEvent('@event:export_progress', { exportId, connectionId, phase, rows });

  try {
    report('preparing');
    const { instance, dialect } = await getConnection(connectionId);
    checkCanceled();
    const adapter = getDialectAdapter(dialect);
    const safeBatchSize = Math.max(1, Math.min(Math.floor(Number(batchSize)) || 1000, 100000));
    const eachRowsBatch = async (callback: (batch: Record<string, unknown>[]) => Promise<void>) => {
      checkCanceled();
      report('exporting');
      for (let page = 1; ; page += 1) {
        checkCanceled();
        const sql = getExportSql(source, adapter.quoteIdentifier, {
          limit: safeBatchSize,
          offset: (page - 1) * safeBatchSize,
        });
        const raw = await instance.raw(sql);
        checkCanceled();
        const batch = getSerializedExportResult(adapter, raw, sql).rows;
        if (!batch.length) break;
        await callback(batch);
        rows += batch.length;
        report('exporting');
        await new Promise<void>((resolve) => setImmediate(resolve));
        checkCanceled();
        if (batch.length < safeBatchSize) break;
      }
      report('finalizing');
      return rows;
    };

    return await exportRowsToFile({ columns, format, fileName }, eachRowsBatch, checkCanceled, beginPublishing);
  } catch (error) {
    if (error instanceof ExportCanceledError) return { canceled: true, rows };
    throw error;
  } finally {
    activeExports.delete(exportId);
  }
};

const activeImports = new Map<string, {
  connectionId: string;
  canceled: boolean;
  finalizing: boolean;
}>();

class ImportCanceledError extends Error {}

export const cancelImport = (connectionId: string, importId: string) => {
  const job = activeImports.get(importId);
  if (!job || job.connectionId !== connectionId || job.finalizing) return false;
  job.canceled = true;
  return true;
};

export const importTableData = async (
  connectionId: string,
  { schema, table, rows, importId }: IImportTableDataParams,
): Promise<IImportTableDataResult> => {
  if (!table) throw new Error('Tabela não informada.');
  if (!importId || activeImports.has(importId)) throw new Error('Importação inválida.');

  const job = { connectionId, canceled: false, finalizing: false };
  activeImports.set(importId, job);
  const rowsToImport = rows.filter((row) => Object.keys(row).length);
  let insertedRows = 0;
  const checkCanceled = () => {
    if (job.canceled) throw new ImportCanceledError();
  };
  const report = (phase: IImportProgress['phase']) =>
    emitEvent('@event:import_progress', {
      importId, connectionId, phase, rows: insertedRows, totalRows: rowsToImport.length,
    });

  try {
    report('preparing');
    if (!rowsToImport.length) return { canceled: false, insertedRows: 0 };
    const { instance, dialect } = await getConnection(connectionId);
    checkCanceled();
    const adapter = getDialectAdapter(dialect);
    const chunkSize = 500;

    await instance.transaction(async (trx) => {
      // Reuse the dialect check so cancellation never promises rollback on MyISAM, etc.
      await adapter.validateQueryUpdateTable?.(trx, { schema, table });
      checkCanceled();
      report('importing');
      for (let index = 0; index < rowsToImport.length; index += chunkSize) {
        checkCanceled();
        const chunk = rowsToImport.slice(index, index + chunkSize);
        const query = schema ? trx.withSchema(schema).table(table) : trx.table(table);
        await query.insert(chunk);
        insertedRows += chunk.length;
        report('importing');
        await new Promise<void>((resolve) => setImmediate(resolve));
        checkCanceled();
      }
      // No longer accept cancellation once COMMIT is about to start.
      job.finalizing = true;
      report('finalizing');
    });

    return { canceled: false, insertedRows };
  } catch (error) {
    if (error instanceof ImportCanceledError) return { canceled: true, insertedRows: 0 };
    throw error;
  } finally {
    activeImports.delete(importId);
  }
};
