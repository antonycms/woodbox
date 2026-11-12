import type { CanonicalTableFilterValue, PrepareInitialWhereRequest, PreparedInitialWhere, ReadInitialWhereRequest, ReadInitialWhereResult } from '@shared/types/database';
import type { DatabaseDialectAdapter, IConnection } from '../types';
import { compareFilterValue, filterIdentifier } from './comparison';
import { captureFilterValue, unavailable } from './values';
import { executeFilterQuery } from './query';
import { serializeIpcError } from '../../ipc/errors';

export const withTableFilterRequest = async <T>(connection: IConnection, adapter: DatabaseDialectAdapter,
  action: (dbConnection: object) => Promise<T>): Promise<T> => {
  const dbConnection: object = await connection.instance.client.acquireConnection();
  let releaseAffinity: (() => void) | undefined;
  try {
    releaseAffinity = await adapter.beginTableFilterRequest?.(dbConnection);
    return await action(dbConnection);
  } finally {
    try { releaseAffinity?.(); } finally { await connection.instance.client.releaseConnection(dbConnection); }
  }
};
const resolveInitialWhere = async (
  connection: IConnection,
  adapter: DatabaseDialectAdapter,
  physical: object,
  request: PrepareInitialWhereRequest,
): Promise<PreparedInitialWhere> => {
  if (!request.column || request.column.includes('\0')) return unavailable('invalid-filter');
  const value: CanonicalTableFilterValue = captureFilterValue(request.value);
  const hasLegacyContext = request.legacyContext !== undefined;
  const comparisonColumn = value.kind === 'null' || !hasLegacyContext ? undefined : request.column;
  const known = !request.includeColumns && !hasLegacyContext &&
    request.columnInfo?.column_name === request.column ? request.columnInfo : undefined;
  const columns = known ? []
    : await adapter.getTableFilterColumns(connection.instance, physical, request, comparisonColumn);
  const column = known || columns.find((item) => item.column_name === request.column);
  if (!column) return unavailable('unresolved-target');

  const comparison = compareFilterValue(connection.dialect, column, value, hasLegacyContext);
  if (hasLegacyContext && request.legacyContext !== comparison.context) return unavailable('context-changed');
  const identifier = filterIdentifier(connection.dialect, request.column);
  const where = comparison.operand ? `${identifier} = ${comparison.operand.literal}` : `${identifier} IS NULL`;
  return {
    where,
    ...(request.includeColumns ? {
      columns: columns.filter((item) => !item.presentationHidden)
        .map(({ presentationHidden, ...item }) => item),
    } : {}),
  };
};

export const prepareInitialWhere = async (
  connection: IConnection, adapter: DatabaseDialectAdapter, request: PrepareInitialWhereRequest,
): Promise<PreparedInitialWhere> =>
  withTableFilterRequest(connection, adapter, (physical) => resolveInitialWhere(connection, adapter, physical, request));

export const readInitialWhere = async (
  connection: IConnection, adapter: DatabaseDialectAdapter, request: ReadInitialWhereRequest,
): Promise<ReadInitialWhereResult> =>
  withTableFilterRequest(connection, adapter, async (physical) => {
    const prepared = await resolveInitialWhere(connection, adapter, physical, request);
    try {
      const sql = adapter.queries.selectWithOffset({
        table: request.table, schema: request.schema, actualPage: request.page ?? 1,
        limit: request.limit ?? 200, orderBy: request.orderBy, where: prepared.where,
      });
      const { raw } = await executeFilterQuery(connection.instance, physical, connection.instance.raw(sql));
      return { ...prepared, data: adapter.getRows(raw) };
    } catch (error) {
      return { ...prepared, data: [], error: serializeIpcError(error) };
    }
  });
