import type { ISnippet } from '@renderer/contexts/Store';
import type { Dialect } from '@renderer/database/dialects';

export type SnippetInput = Omit<ISnippet, 'id' | 'created_at' | 'updated_at'>;

type VsCodeSnippetPayload = {
  scope?: unknown;
  prefix?: unknown;
  body?: unknown;
  description?: unknown;
};

const isStringArray = (value: unknown): value is string[] => {
  return Array.isArray(value) && value.every((item) => typeof item === 'string');
};

export const getSnippetPrefixes = (prefix: ISnippet['prefix']) => {
  return (Array.isArray(prefix) ? prefix : [prefix]).map((item) => item.trim()).filter(Boolean);
};

export const getSnippetScopes = (scope?: string) => {
  return (
    scope
      ?.split(',')
      .map((item) => item.trim().toLowerCase())
      .filter(Boolean) || []
  );
};

export const getSnippetBodyText = (body: ISnippet['body']) => {
  return Array.isArray(body) ? body.join('\n') : body;
};

export const isSnippetAvailableForDialect = (snippet: ISnippet, dialect?: Dialect) => {
  const scopes = getSnippetScopes(snippet.scope);

  if (!scopes.length) return true;
  if (!dialect) return false;

  return scopes.includes(dialect);
};

export const toSnippetExportObject = (
  snippet: Pick<ISnippet, 'name' | 'scope' | 'prefix' | 'body' | 'description'>,
) => {
  return {
    [snippet.name]: {
      ...(snippet.scope ? { scope: snippet.scope } : {}),
      prefix: snippet.prefix,
      body: snippet.body,
      ...(snippet.description ? { description: snippet.description } : {}),
    },
  };
};

export const downloadSnippetFile = (snippet: ISnippet) => {
  const content = JSON.stringify(toSnippetExportObject(snippet), null, 2);
  const blob = new Blob([content], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement('a');
  const filename = snippet.name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9_-]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();

  anchor.href = url;
  anchor.download = `${filename || 'snippet'}.code-snippets`;
  anchor.click();
  URL.revokeObjectURL(url);
};

const stripJsonComments = (content: string) => {
  let result = '';
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < content.length; index++) {
    const char = content[index];
    const nextChar = content[index + 1];

    if (inString) {
      result += char;

      if (char === '"' && !isEscaped) {
        inString = false;
      }

      isEscaped = char === '\\' && !isEscaped;
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === '/' && nextChar === '/') {
      while (index < content.length && content[index] !== '\n') index++;
      result += '\n';
      continue;
    }

    if (char === '/' && nextChar === '*') {
      index += 2;
      while (index < content.length && !(content[index] === '*' && content[index + 1] === '/')) {
        index++;
      }
      index++;
      continue;
    }

    result += char;
  }

  return result;
};

const stripJsonTrailingCommas = (content: string) => {
  let result = '';
  let inString = false;
  let isEscaped = false;

  for (let index = 0; index < content.length; index++) {
    const char = content[index];

    if (inString) {
      result += char;

      if (char === '"' && !isEscaped) {
        inString = false;
      }

      isEscaped = char === '\\' && !isEscaped;
      continue;
    }

    if (char === '"') {
      inString = true;
      result += char;
      continue;
    }

    if (char === ',') {
      let nextIndex = index + 1;

      while (/\s/.test(content[nextIndex])) nextIndex++;

      if (content[nextIndex] === '}' || content[nextIndex] === ']') continue;
    }

    result += char;
  }

  return result;
};

const validateSnippetPayload = (name: string, payload: VsCodeSnippetPayload): SnippetInput => {
  if (!payload || typeof payload !== 'object') {
    throw new Error(`Snippet "${name}" inválido.`);
  }

  const prefix = payload.prefix;
  const body = payload.body;
  const scope = payload.scope;
  const description = payload.description;

  if (typeof prefix !== 'string' && !isStringArray(prefix)) {
    throw new Error(`Snippet "${name}" sem prefix válido.`);
  }

  if (typeof body !== 'string' && !isStringArray(body)) {
    throw new Error(`Snippet "${name}" sem body válido.`);
  }

  return {
    name,
    prefix,
    body,
    scope: typeof scope === 'string' ? scope : undefined,
    description: typeof description === 'string' ? description : undefined,
  };
};

export const parseSnippetsFileContent = (content: string): SnippetInput[] => {
  const parsed = JSON.parse(stripJsonTrailingCommas(stripJsonComments(content))) as Record<
    string,
    VsCodeSnippetPayload
  >;

  if (!parsed || typeof parsed !== 'object' || Array.isArray(parsed)) {
    throw new Error('Arquivo de snippets inválido.');
  }

  return Object.entries(parsed).map(([name, payload]) => validateSnippetPayload(name, payload));
};
