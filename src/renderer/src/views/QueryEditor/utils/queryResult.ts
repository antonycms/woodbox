import type { IDataUpdateabResult, IQueryResult } from '../dtos';
import { getErrorMessage } from '@shared/utils/error';

type QueryErrorMarkerPosition = {
  lineNumber: number;
  column: number;
};

export const makeCanceledQueryResult = (
  message: string,
  data?: Pick<IQueryResult, 'query' | 'variableValues'>,
): IDataUpdateabResult => ({
  type: 'ERROR',
  query: data?.query,
  variableValues: data?.variableValues,
  message,
  loading: false,
  queryExecutionId: undefined,
});

export const formatQueryErrorMessage = (error: unknown, fallback: string) => {
  const message = getErrorMessage(error, fallback);
  const separatorIndex = message.lastIndexOf(' - ');

  if (separatorIndex < 0) return message;

  const query = message.slice(0, separatorIndex).trim();
  const errorMessage = message.slice(separatorIndex + 3).trim();

  if (!query || !errorMessage) return message;

  return `${errorMessage}\n\n${query}`;
};

export const formatQueryExecutionErrorMessage = (error: unknown, fallback: string, markErrors?: boolean) => {
  const message = getErrorMessage(error, fallback);

  return markErrors
    ? message.split(' - ')[1] || message
    : formatQueryErrorMessage(error, fallback);
};

export const getQueryErrorOffset = (error: unknown) => {
  const position = Number(error && typeof error === 'object' && 'position' in error ? error.position : undefined);

  return Number.isFinite(position) && position > 0 ? position - 1 : undefined;
};

export const makeQueryErrorMarker = (
  message: string,
  startPosition: QueryErrorMarkerPosition,
  endPosition: QueryErrorMarkerPosition,
) => ({
  message,
  startLineNumber: startPosition.lineNumber,
  endLineNumber: endPosition.lineNumber,
  code: `SQL Error`,
  startColumn: startPosition.column,
  endColumn: endPosition.column,
  severity: 'Error' as const,
});

const normalizeCaptureValue = (value: unknown): unknown => {
  if (typeof value === 'bigint') return String(value);
  if (value instanceof Date) return value.toISOString();
  if (Array.isArray(value)) return value.map(normalizeCaptureValue);

  if (value && typeof value === 'object') {
    return Object.keys(value)
      .sort()
      .reduce<Record<string, unknown>>((acc, key) => {
        acc[key] = normalizeCaptureValue((value as Record<string, unknown>)[key]);
        return acc;
      }, {});
  }

  return value;
};

export const getCaptureRowHash = (row: unknown) => JSON.stringify(normalizeCaptureValue(row));
