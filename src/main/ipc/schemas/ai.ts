import { z } from 'zod';
import { dialect } from './connections';

export const provider = z.object({
  id: z.string().optional(), name: z.string(),
  type: z.enum(['openai', 'anthropic', 'google', 'openrouter', 'openai-compatible', 'codex-chatgpt']),
  models: z.array(z.string()), apiKey: z.string().optional(), baseURL: z.string().optional(),
});

const messageInput = z.object({ role: z.enum(['user', 'assistant']), content: z.string() });
const message = messageInput.extend({
  id: z.string(), created_at: z.string(),
  queryApprovals: z.array(z.object({
    id: z.string(), connectionId: z.string(), connectionName: z.string(), dialect,
    database: z.string(), sql: z.string(), limit: z.number(),
    status: z.enum(['pending', 'approved', 'rejected']).optional(),
  })).optional(),
  queryResult: z.object({
    rows: z.array(z.record(z.string(), z.unknown())), columns: z.array(z.string()).optional(),
  }).optional(),
});

export const chat = z.object({
  id: z.string().optional(), title: z.string(), summary: z.string().optional(),
  messages: z.array(message).optional(), providerId: z.string().optional(),
  model: z.string().optional(), connectionId: z.string().optional(),
});
export const chatPatch = chat.omit({ id: true }).partial();
export const appendMessages = z.object({
  title: z.string().optional(), summary: z.string().optional(), messages: z.array(message),
});
export const chatRequest = z.object({
  requestId: z.string().optional(), providerId: z.string().optional(), model: z.string().optional(),
  mentionedConnectionIds: z.array(z.string()).optional(), messages: z.array(messageInput),
});
