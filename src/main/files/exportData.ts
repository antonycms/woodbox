import path from 'path';
import { app, BrowserWindow, clipboard, dialog } from 'electron';
import type { ExportDataFormat, IExportDataResult } from '@shared/types/database';
import { writeExportFile } from './export';
import type { ExportFileOptions, ExportFormat } from './export/types';
import { serializeExportValue, stringifyExportValue } from './export/serializers';

type ExportOptions = Omit<ExportFileOptions, 'filePath' | 'format'> & {
  format: ExportDataFormat;
  fileName?: string;
};

const EXPORT_FORMAT_FILTERS: Record<ExportFormat, Electron.FileFilter> = {
  csv: { name: 'CSV', extensions: ['csv'] },
  json: { name: 'JSON', extensions: ['json'] },
  jsonl: { name: 'JSONL', extensions: ['jsonl'] },
  xlsx: { name: 'Excel', extensions: ['xlsx'] },
};

const normalizeExportFileName = (value?: string) => {
  const name = value?.trim() || `woodbox-export-${new Date().toISOString().replace(/[:.]/g, '-')}`;
  return name.replace(/[\\/:*?"<>|]+/g, '-').slice(0, 180);
};

const serializeClipboardCell = (value: unknown) => {
  if (value === null || value === undefined) return '';
  const serializedValue = serializeExportValue(value);
  const text = typeof serializedValue === 'object'
    ? stringifyExportValue(serializedValue)
    : String(serializedValue);
  return text.replace(/\t/g, ' ').replace(/\r?\n/g, ' ');
};

const exportRowsToClipboard = async (options: ExportOptions): Promise<IExportDataResult> => {
  const { columns, batchSize, readPage, isCanceled, onProgress } = options;
  const lines = [columns.map(serializeClipboardCell).join('\t')];
  let rows = 0;
  onProgress(rows);

  for (let page = 1; !isCanceled(); page += 1) {
    const batch = await readPage(page);
    if (isCanceled() || !batch.length) break;
    for (const row of batch) {
      lines.push(columns.map((column) => serializeClipboardCell(row[column])).join('\t'));
    }
    rows += batch.length;
    onProgress(rows);
    await new Promise<void>((resolve) => setImmediate(resolve));
    if (batch.length < batchSize) break;
  }

  if (isCanceled()) return { canceled: true, rows };
  clipboard.writeText(lines.join('\n'));
  return { canceled: false, rows };
};

export const exportRowsToFile = async (options: ExportOptions): Promise<IExportDataResult> => {
  const { format, fileName, isCanceled } = options;
  if (isCanceled()) return { canceled: true, rows: 0 };
  if (format === 'clipboard') return exportRowsToClipboard(options);
  if (!Object.hasOwn(EXPORT_FORMAT_FILTERS, format)) {
    throw new Error('Formato de exportação inválido.');
  }

  const saveOptions: Electron.SaveDialogOptions = {
    defaultPath: path.join(app.getPath('downloads'), `${Date.now()}_${normalizeExportFileName(fileName)}.${format}`),
    filters: [EXPORT_FORMAT_FILTERS[format]],
  };
  const parentWindow = BrowserWindow.getFocusedWindow();
  const result = parentWindow
    ? await dialog.showSaveDialog(parentWindow, saveOptions)
    : await dialog.showSaveDialog(saveOptions);
  if (isCanceled() || result.canceled || !result.filePath) return { canceled: true, rows: 0 };

  const filePath = path.extname(result.filePath).toLowerCase() === `.${format}`
    ? result.filePath
    : `${result.filePath}.${format}`;
  return writeExportFile({ ...options, filePath, format });
};
