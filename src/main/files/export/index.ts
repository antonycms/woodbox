import fs from 'fs';
import { randomUUID } from 'crypto';
import { once } from 'events';
import { finished } from 'stream/promises';
// @ts-expect-error Node's test runner loads the TypeScript module directly.
import { exportWriters } from './writers.ts';
import type { ExportFileOptions, ExportWriterContext } from './types.ts';

export type { ExportFormat } from './types.ts';

const waitForStreamOpen = (stream: fs.WriteStream) => once(stream, 'open');

// Publish only complete files, preserving an existing destination on cancellation or failure.
export const writeExportFile = async (options: ExportFileOptions) => {
  const { batchSize, columns, filePath, format, isCanceled, onProgress, readPage } = options;
  const temporaryPath = `${filePath}.${randomUUID()}.partial`;
  const stream = fs.createWriteStream(temporaryPath, { flags: 'wx' });
  const completion = finished(stream);
  const writer = exportWriters[format] as (context: ExportWriterContext) => Promise<void>;
  let rows = 0;
  const reportProgress = (nextRows: number) => {
    rows = nextRows;
    onProgress(nextRows);
  };

  void completion.catch(() => {});

  try {
    await waitForStreamOpen(stream);
    reportProgress(0);

    await writer({
      stream,
      columns,
      batchSize,
      readPage,
      isCanceled,
      onProgress: reportProgress,
    });

    stream.end();
    await completion;

    if (isCanceled()) return { canceled: true, rows };

    await fs.promises.rename(temporaryPath, filePath);
    return { canceled: false, filePath, rows };
  } finally {
    stream.destroy();
    await completion.catch(() => {});
    await fs.promises.rm(temporaryPath, { force: true });
  }
};
