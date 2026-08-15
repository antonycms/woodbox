import type { IAIChatResponse, IConnection } from '@renderer/contexts/Store';

export const normalizeSqlForComparison = (sql: string) =>
  sql.trim().replace(/;+\s*$/, '').replace(/\s+/g, ' ').toLowerCase();

export const getResponseQueryApprovals = (
  response: IAIChatResponse,
  connectionIds: string[],
  _connections: IConnection[],
) => {
  const allowedConnectionIds = new Set(connectionIds.filter(Boolean));
  const structuredQueryApprovals = (response.queryApprovals || []).filter((approval) => {
    if (!allowedConnectionIds.size) return true;

    return allowedConnectionIds.has(approval.connectionId);
  });

  return structuredQueryApprovals;
};

export const isReadOnlySelectQuery = (sql: string) => {
  const normalizedSql = normalizeSqlForComparison(sql);
  const unsafeKeywordPattern =
    /\b(alter|analyze|call|copy|create|delete|drop|execute|grant|insert|merge|reindex|revoke|truncate|update|vacuum)\b/;

  if (normalizedSql.includes(';') || unsafeKeywordPattern.test(normalizedSql)) return false;

  return normalizedSql.startsWith('select ') || normalizedSql.startsWith('with ');
};
