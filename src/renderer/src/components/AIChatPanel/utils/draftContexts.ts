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
