import ExcelJS from 'exceljs';
import { once } from 'events';
import type { ExportWriterContext } from './types.ts';
// @ts-expect-error Node's test runner loads the TypeScript module directly.
import { serializeCsvCell, serializeExportRow, stringifyExportValue } from './serializers.ts';

const writeToStream = (stream: ExportWriterContext['stream'], content: string) =>
  new Promise<void>((resolve, reject) => {
    stream.write(content, (error) => (error ? reject(error) : resolve()));
  });

const readBatches = async function* (context: ExportWriterContext) {
  const { batchSize, isCanceled, onProgress, readPage, stream } = context;
  let rows = 0;

  for (let page = 1; !isCanceled(); page += 1) {
    if (stream.errored) throw stream.errored;

    const batch = await readPage(page);

    if (stream.errored) throw stream.errored;
    if (isCanceled() || !batch.length) break;

    rows += batch.length;
    onProgress(rows);
    yield batch;

    // Let cancellation IPC run even when the driver resolves immediately.
    await new Promise<void>((resolve) => setImmediate(resolve));

    if (batch.length < batchSize) break;
  }
};

const writeCsv = async (context: ExportWriterContext) => {
  const { columns, stream } = context;
  await writeToStream(stream, `\ufeff${columns.map(serializeCsvCell).join(',')}\n`);

  for await (const batch of readBatches(context)) {
    const rows = batch
      .map((row) => columns.map((column) => serializeCsvCell(row[column])).join(','))
      .join('\n');

    await writeToStream(stream, `${rows}\n`);
  }
};

const writeJsonl = async (context: ExportWriterContext) => {
  const { columns, stream } = context;

  for await (const batch of readBatches(context)) {
    const rows = batch
      .map((row) => stringifyExportValue(serializeExportRow(row, columns)))
      .join('\n');

    await writeToStream(stream, `${rows}\n`);
  }
};

const writeJson = async (context: ExportWriterContext) => {
  const { columns, stream } = context;
  let firstRow = true;

  await writeToStream(stream, '[\n');

  for await (const batch of readBatches(context)) {
    for (const row of batch) {
      const separator = firstRow ? '' : ',\n';
      const serializedRow = stringifyExportValue(serializeExportRow(row, columns));

      await writeToStream(stream, `${separator}  ${serializedRow}`);
      firstRow = false;
    }
  }

  await writeToStream(stream, '\n]\n');
};

const writeXlsx = async (context: ExportWriterContext) => {
  const { columns, stream } = context;
  const workbook = new ExcelJS.stream.xlsx.WorkbookWriter({ stream });
  const worksheet = workbook.addWorksheet('Dados');

  worksheet.columns = columns.map((column) => ({ header: column, key: column }));

  try {
    for await (const batch of readBatches(context)) {
      for (const row of batch) {
        worksheet.addRow(serializeExportRow(row, columns)).commit();
      }
    }
  } finally {
    worksheet.commit();
    await Promise.race([workbook.commit(), once(stream, 'finish')]);
  }
};

export const exportWriters = {
  csv: writeCsv,
  json: writeJson,
  jsonl: writeJsonl,
  xlsx: writeXlsx,
};
