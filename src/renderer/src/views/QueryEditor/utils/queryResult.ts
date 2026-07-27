import type { IDataUpdateabResult, IQueryResult } from '../dtos';

type QueryExecutionError = Error & { position?: string | number };

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

export const formatQueryErrorMessage = (error: unknown) => {
  const queryError = error as QueryExecutionError;
  const message = queryError?.message || 'Erro desconhecido';
  const separatorIndex = message.lastIndexOf(' - ');

  if (separatorIndex < 0) return message;

  const query = message.slice(0, separatorIndex).trim();
  const errorMessage = message.slice(separatorIndex + 3).trim();

  if (!query || !errorMessage) return message;

  return `${errorMessage}\n\n${query}`;
};

export const getQueryErrorOffset = (error: unknown) => {
  const position = Number((error as QueryExecutionError)?.position);

  return Number.isFinite(position) && position > 0 ? position - 1 : undefined;
};

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
