import fs from 'fs';
import path from 'path';
import { clipboard, dialog } from 'electron';
import ExcelJS from 'exceljs';
import type { ExportDataFormat as ExportFormat, IExportDataParams, IExportDataResult } from '@shared/types/database';

export type ExportRowsBatchConsumer = (
  callback: (rows: Record<string, unknown>[]) => Promise<void>,
) => Promise<number>;

type FileExportFormat = Exclude<ExportFormat, 'clipboard'>;

const EXPORT_FORMAT_FILTERS: Record<FileExportFormat, Electron.FileFilter> = {
  csv: { name: 'CSV', extensions: ['csv'] },
  json: { name: 'JSON', extensions: ['json'] },
  jsonl: { name: 'JSONL', extensions: ['jsonl'] },
  xlsx: { name: 'Excel', extensions: ['xlsx'] },
};

const EXPORT_MIME_EXTENSIONS: Record<FileExportFormat, string> = {
  csv: 'csv',
  json: 'json',
  jsonl: 'jsonl',
  xlsx: 'xlsx',
};

const normalizeExportFileName = (value?: string) => {
  const name = value?.trim?.() || `woodbox-export-${new Date().toISOString().replace(/[:.]/g, '-')}`;

  return name.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 180);
};

const writeStream = (stream: fs.WriteStream, content: string) =>
  new Promise<void>((resolve, reject) => {
    stream.write(content, (error) => (error ? reject(error) : resolve()));
  });

const endStream = (stream: fs.WriteStream) =>
  new Promise<void>((resolve, reject) => {
    stream.end((error) => (error ? reject(error) : resolve()));
  });

const jsonStringify = (value: unknown, space?: number) =>
  JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? String(item) : item), space);

const serializeExportValue = (value: unknown) => {
  if (value === null || value === undefined) return value;
  if (typeof value === 'bigint') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Buffer.isBuffer(value)) return value.toString('base64');

  return value;
};

const serializeExportRow = (row: Record<string, unknown>, columns: string[]) => {
  return columns.reduce<Record<string, unknown>>((acc, column) => {
    acc[column] = serializeExportValue(row[column]);
    return acc;
  }, {});
};

const serializeExportRows = (rows: Record<string, unknown>[], columns: string[]) =>
  rows.map((row) => serializeExportRow(row, columns));

const serializeCsvCell = (value: unknown) => {
  if (value === null || value === undefined) return '';

  const serializedValue = serializeExportValue(value);
  const text =
    typeof serializedValue === 'object' ? jsonStringify(serializedValue) : String(serializedValue);

  return `"${text.replace(/"/g, '""')}"`;
};

const serializeClipboardCell = (value: unknown) => {
  if (value === null || value === undefined) return '';

  const serializedValue = serializeExportValue(value);
  const text =
    typeof serializedValue === 'object' ? jsonStringify(serializedValue) : String(serializedValue);

  return text.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
};

const serializeClipboardRow = (row: Record<string, unknown>, columns: string[]) =>
  columns.map((column) => serializeClipboardCell(row[column])).join('\t');

const exportRowsToClipboard = async (
  { columns }: Pick<IExportDataParams, 'columns'>,
  eachRowsBatch: ExportRowsBatchConsumer,
): Promise<IExportDataResult> => {
  const rows: string[] = [columns.map(serializeClipboardCell).join('\t')];
  const totalRows = await eachRowsBatch(async (batchRows) => {
    rows.push(...batchRows.map((row) => serializeClipboardRow(row, columns)));
  });

  clipboard.writeText(rows.join('\n'));

  return { canceled: false, rows: totalRows };
};

export const exportRowsToFile = async (
  { columns, format, fileName }: Pick<IExportDataParams, 'columns' | 'format' | 'fileName'>,
  eachRowsBatch: ExportRowsBatchConsumer,
): Promise<IExportDataResult> => {
  if (format === 'clipboard') return exportRowsToClipboard({ columns }, eachRowsBatch);

  const extension = EXPORT_MIME_EXTENSIONS[format];
  const result = await dialog.showSaveDialog({
    defaultPath: `${Date.now()}_${normalizeExportFileName(fileName)}.${extension}`,
    filters: [EXPORT_FORMAT_FILTERS[format]],
  });

  if (result.canceled || !result.filePath) return { canceled: true, rows: 0 };

  const filePath =
    path.extname(result.filePath).toLowerCase() === `.${extension}`
      ? result.filePath
      : `${result.filePath}.${extension}`;
  let totalRows = 0;

  if (format === 'xlsx') {
    const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ filename: filePath });
    const worksheet = workbook.addWorksheet('Dados');

    worksheet.columns = columns.map((column) => ({ header: column, key: column }));

    totalRows = await eachRowsBatch(async (batchRows) => {
      for (const row of serializeExportRows(batchRows, columns)) {
        worksheet.addRow(row).commit();
      }
    });

    worksheet.commit();
    await workbook.commit();

    return { canceled: false, filePath, rows: totalRows };
  }

  const stream = fs.createWriteStream(filePath, { encoding: 'utf8' });

  try {
    if (format === 'csv') {
      await writeStream(stream, `\ufeff${columns.map(serializeCsvCell).join(',')}\n`);

      totalRows = await eachRowsBatch(async (batchRows) => {
        const content = batchRows
          .map((row) => columns.map((column) => serializeCsvCell(row[column])).join(','))
          .join('\n');

        if (content) await writeStream(stream, `${content}\n`);
      });
    }

    if (format === 'jsonl') {
      totalRows = await eachRowsBatch(async (batchRows) => {
        const content = serializeExportRows(batchRows, columns).map((row) => jsonStringify(row)).join('\n');

        if (content) await writeStream(stream, `${content}\n`);
      });
    }

    if (format === 'json') {
      let isFirstRow = true;

      await writeStream(stream, '[\n');

      totalRows = await eachRowsBatch(async (batchRows) => {
        for (const row of serializeExportRows(batchRows, columns)) {
          await writeStream(stream, `${isFirstRow ? '' : ',\n'}  ${jsonStringify(row)}`);
          isFirstRow = false;
        }
      });

      await writeStream(stream, '\n]\n');
    }
  } finally {
    await endStream(stream);
  }

  return { canceled: false, filePath, rows: totalRows };
};
