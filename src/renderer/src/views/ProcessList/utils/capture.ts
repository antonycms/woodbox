import type { ProcessListRow } from './rows';

export interface IProcessListCapturedRow {
  captured_at: string;
  row: ProcessListRow;
}

const stringifyCaptureValue = (value: unknown) =>
  JSON.stringify(value, (_, item) => (typeof item === 'bigint' ? String(item) : item));

const normalizeCaptureValue = (value: unknown): unknown => {
  if (Array.isArray(value)) return value.map(normalizeCaptureValue);
  if (!value || typeof value !== 'object') return value;

  return Object.keys(value)
    .sort()
    .reduce<Record<string, unknown>>((acc, key) => {
      acc[key] = normalizeCaptureValue((value as Record<string, unknown>)[key]);
      return acc;
    }, {});
};

export const getProcessCaptureRowHash = (row: unknown) =>
  stringifyCaptureValue(normalizeCaptureValue(row));

export const downloadProcessCaptureFile = (content: string, extension: string, type: string) => {
  const fileDate = new Date().toISOString().replace(/[:.]/g, '-');
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');

  link.href = url;
  link.download = `woodbox-captura-processos-${fileDate}.${extension}`;
  link.click();
  URL.revokeObjectURL(url);
};

export const buildProcessCaptureJsonl = (capturedRows: IProcessListCapturedRow[]) =>
  capturedRows.map((row) => stringifyCaptureValue(row)).join('\n');

const formatCaptureCsvCell = (value: unknown) => {
  if (value === null || value === undefined) return '""';

  const text =
    typeof value === 'object' || typeof value === 'bigint' ? stringifyCaptureValue(value) : String(value);

  return `"${text.replace(/"/g, '""')}"`;
};

export const buildProcessCaptureCsv = (capturedRows: IProcessListCapturedRow[]) => {
  const columns = [
    ...capturedRows.reduce((acc, capturedRow) => {
      Object.keys(capturedRow.row || {}).forEach((column) => acc.add(column));

      return acc;
    }, new Set<string>()),
  ];
  const header = ['captured_at', ...columns].map(formatCaptureCsvCell).join(',');
  const rows = capturedRows.map((capturedRow) =>
    [capturedRow.captured_at, ...columns.map((column) => capturedRow.row[column])]
      .map(formatCaptureCsvCell)
      .join(','),
  );

  return [header, ...rows].join('\n');
};
