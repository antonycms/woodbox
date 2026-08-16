import type { IAIChatDraftContext } from '../types';

export const formatAIChatDraftContext = (context: IAIChatDraftContext) => {
  return `${context.title}:\n\n\`\`\`${context.language || ''}\n${context.content}\n\`\`\``;
};

export const buildAIChatMessageContent = (
  draftMessage: string,
  contexts: IAIChatDraftContext[] = [],
) => {
  return [...contexts.map(formatAIChatDraftContext), draftMessage.trim()].filter(Boolean).join('\n\n');
};

const EDITOR_CONTEXT_PATTERN = /(Contexto do editor|Editor context):\n\n```[a-zA-Z0-9_-]*\n?[\s\S]*?```/g;

export const getAIChatUserContent = (content: string) => {
  return content.replace(EDITOR_CONTEXT_PATTERN, '').trim();
};
