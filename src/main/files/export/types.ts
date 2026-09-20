import type { Writable } from 'stream';

type ExportFormat = 'csv' | 'json' | 'jsonl' | 'xlsx';

interface ExportFileOptions {
  filePath: string;
  format: ExportFormat;
  columns: string[];
  batchSize: number;
  readPage(page: number): Promise<Record<string, unknown>[]>;
  isCanceled(): boolean;
  onProgress(rows: number): void;
}

interface ExportWriterContext {
  stream: Writable;
  columns: string[];
  batchSize: number;
  readPage(page: number): Promise<Record<string, unknown>[]>;
  isCanceled(): boolean;
  onProgress(rows: number): void;
}

export type { ExportFileOptions, ExportFormat, ExportWriterContext }