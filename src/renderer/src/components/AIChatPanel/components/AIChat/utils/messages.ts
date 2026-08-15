import type { IAIQueryApproval, IAIQueryResult } from '@renderer/contexts/Store';

type RunSqlResultItem = {
  rows?: unknown;
  columns?: unknown;
};

export const getExcerpt = (content: string, maxLength: number) => {
  const excerpt = content.replace(/\s+/g, ' ').trim();

  if (excerpt.length <= maxLength) return excerpt;

  return `${excerpt.slice(0, maxLength - 1)}…`;
};

export const getAssistantContent = (
  rawContent: string,
  queryApprovals: IAIQueryApproval[],
  approvalMessage: string,
) => {
  const content = rawContent.trim();

  if (content) return content;
  if (queryApprovals.length) return approvalMessage;

  return '';
};

export const serializeQueryResultForAI = (approval: IAIQueryApproval, result: unknown) => {
  return [
    'A query abaixo JÁ FOI APROVADA pelo usuário e JÁ FOI EXECUTADA pelo aplicativo.',
    'Não peça nova confirmação. Não solicite nova execução para a mesma consulta.',
    'Responda diretamente à pergunta original usando apenas os dados retornados.',
    `Conexão: ${approval.connectionName}`,
    `Database: ${approval.database}`,
    `SQL executada:`,
    '```sql',
    approval.sql,
    '```',
    'Dados retornados em JSON:',
    '```json',
    JSON.stringify(result, null, 2),
    '```',
    'Responda ao usuário com base nesses dados. Não execute nova consulta sem nova confirmação.',
  ].join('\n');
};

export const getQueryResultForTable = (result: unknown): IAIQueryResult | undefined => {
  if (!Array.isArray(result)) return undefined;

  const item = result.find((resultItem: RunSqlResultItem) => Array.isArray(resultItem?.rows)) as
    | RunSqlResultItem
    | undefined;

  if (!item || !Array.isArray(item.rows)) return undefined;

  const rows = item.rows.filter(
    (row): row is Record<string, unknown> =>
      !!row && typeof row === 'object' && !Array.isArray(row),
  );
  const columns = Array.isArray(item.columns)
    ? item.columns.filter((column): column is string => typeof column === 'string')
    : undefined;

  return { rows, columns };
};

export const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;

  return String(error);
};
