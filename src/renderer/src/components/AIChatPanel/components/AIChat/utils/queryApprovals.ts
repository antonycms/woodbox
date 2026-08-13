import type { IConnection } from '@renderer/contexts/Store';
import { generateHash } from '@renderer/utils/string';

const extractSqlBlocks = (content: string) => {
  return [...content.matchAll(/```(?:sql)?\s*([\s\S]*?)```/gi)]
    .map((match) => match[1].trim().replace(/;+\s*$/, ''))
    .filter(Boolean);
};

export const normalizeSqlForComparison = (sql: string) =>
  sql.trim().replace(/;+\s*$/, '').replace(/\s+/g, ' ').toLowerCase();

export const buildFallbackQueryApprovals = (
  content: string,
  connectionIds: string[],
  connections: IConnection[],
) => {
  const effectiveConnectionIds = [...new Set(connectionIds.filter(Boolean))];

  if (effectiveConnectionIds.length !== 1) return [];

  const connection = connections.find((item) => item.id === effectiveConnectionIds[0]);

  if (!connection) return [];

  return extractSqlBlocks(content).map((sql) => ({
    id: generateHash(),
    connectionId: connection.id,
    connectionName: connection.description,
    dialect: connection.dialect,
    database: connection.database,
    sql,
    limit: 200,
    status: 'pending' as const,
  }));
};

export const isReadOnlySelectQuery = (sql: string) => {
  const normalizedSql = normalizeSqlForComparison(sql);
  const unsafeKeywordPattern =
    /\b(alter|analyze|call|copy|create|delete|drop|execute|grant|insert|merge|reindex|revoke|truncate|update|vacuum)\b/;

  if (normalizedSql.includes(';') || unsafeKeywordPattern.test(normalizedSql)) return false;

  return normalizedSql.startsWith('select ') || normalizedSql.startsWith('with ');
};
