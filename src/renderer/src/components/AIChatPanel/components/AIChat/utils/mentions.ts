import type { IConnection } from '@renderer/contexts/Store';
import type { IActiveMention } from '../dtos';

export const normalizeMention = (value: string) =>
  value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');

export const compactMention = (value: string) => normalizeMention(value).replace(/-/g, '');

export const escapeRegExp = (value: string) => value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

export const getConnectionMention = (connection: IConnection) => {
  const baseName = connection.description || connection.database || connection.id;

  return `@${normalizeMention(baseName)}`;
};

export const getConnectionMentionAliases = (connection: IConnection) => {
  const baseName = connection.description || connection.database || connection.id;

  return [
    getConnectionMention(connection),
    `@${compactMention(baseName)}`,
    `@${normalizeMention(connection.database || '')}`,
    `@${compactMention(connection.database || '')}`,
  ].filter((alias) => alias.length > 1);
};

export const getActiveMention = (text: string, cursor: number): IActiveMention | undefined => {
  const prefix = text.slice(0, cursor);
  const match = /(?:^|\s)(@[a-zA-Z0-9_.-]*)$/.exec(prefix);

  if (!match) return undefined;

  const suffix = text.slice(cursor);
  const suffixToken = /^[a-zA-Z0-9_.-]*/.exec(suffix)?.[0] || '';
  const mention = match[1];

  return {
    start: cursor - mention.length,
    end: cursor + suffixToken.length,
    query: mention.slice(1).toLowerCase(),
  };
};

export const getMentionedConnectionIdsFromText = (text: string, connections: IConnection[]) => {
  const mentionTokens = new Set(
    text
      .match(/@[a-zA-Z0-9_.-]+/g)
      ?.map((mention) => mention.toLowerCase()) || [],
  );

  if (!mentionTokens.size) return [];

  return connections
    .filter((connection) =>
      getConnectionMentionAliases(connection).some((alias) => mentionTokens.has(alias)),
    )
    .map((connection) => connection.id);
};
