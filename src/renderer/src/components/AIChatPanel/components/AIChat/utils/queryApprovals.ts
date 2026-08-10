import type { IAIChatMessage, IConnection } from '@renderer/contexts/Store';
import { generateHash } from '@renderer/utils/string';
import {
  compactMention,
  getConnectionMention,
  getConnectionMentionAliases,
  getMentionedConnectionIdsFromText,
  normalizeMention,
} from './mentions';

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
  contextMessages: IAIChatMessage[] = [],
) => {
  const normalizedContent = normalizeMention(content);
  const compactContent = compactMention(content);
  const inferredConnectionIds = connections
    .filter((connection) => {
      const aliases = [
        connection.description,
        connection.database,
        getConnectionMention(connection),
        ...getConnectionMentionAliases(connection),
      ].filter(Boolean);

      return aliases.some((alias) => {
        const normalizedAlias = normalizeMention(alias);
        const compactAlias = compactMention(alias);

        return (
          (!!normalizedAlias && normalizedContent.includes(normalizedAlias)) ||
          (!!compactAlias && compactContent.includes(compactAlias))
        );
      });
    })
    .map((connection) => connection.id);
  const contextConnectionIds = [...contextMessages]
    .reverse()
    .map((message) => getMentionedConnectionIdsFromText(message.content, connections))
    .find((ids) => ids.length === 1);
  const effectiveConnectionIds = connectionIds.length
    ? connectionIds
    : inferredConnectionIds.length === 1
      ? inferredConnectionIds
      : contextConnectionIds?.length === 1
        ? contextConnectionIds
        : connections.length === 1
          ? [connections[0].id]
          : [];

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
