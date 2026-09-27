import type { Dialect } from './connections';

export type AIProviderType =
  | 'openai'
  | 'anthropic'
  | 'google'
  | 'openrouter'
  | 'openai-compatible'
  | 'codex-chatgpt';

export interface IAIProviderConfig {
  id: string;
  name: string;
  type: AIProviderType;
  models: string[];
  apiKey?: string;
  baseURL?: string;
  created_at: string;
  updated_at: string;
}

export interface IAIProviderPublic
  extends Omit<IAIProviderConfig, 'apiKey'> {
  hasApiKey: boolean;
}

export interface IAIProviderInput {
  id?: string;
  name: string;
  type: AIProviderType;
  models: string[];
  apiKey?: string;
  baseURL?: string;
}

export interface IAIChatMessageInput {
  role: 'user' | 'assistant';
  content: string;
}

export interface IAIQueryApproval {
  id: string;
  connectionId: string;
  connectionName: string;
  dialect: Dialect;
  database: string;
  sql: string;
  limit: number;
  status?: 'pending' | 'approved' | 'rejected';
}

export interface IAIQueryResult {
  rows: Record<string, unknown>[];
  columns?: string[];
}

export interface IAIChatMessage extends IAIChatMessageInput {
  id: string;
  created_at: string;
  queryApprovals?: IAIQueryApproval[];
  queryResult?: IAIQueryResult;
}

export interface IAIChat {
  id: string;
  title: string;
  summary: string;
  messages: IAIChatMessage[];
  providerId?: string;
  model?: string;
  connectionId?: string;
  created_at: string;
  updated_at: string;
}

export interface IAIChatInput {
  id?: string;
  title: string;
  summary?: string;
  messages?: IAIChatMessage[];
  providerId?: string;
  model?: string;
  connectionId?: string;
}

export interface IAIChatPatch {
  title?: string;
  summary?: string;
  messages?: IAIChatMessage[];
  providerId?: string;
  model?: string;
  connectionId?: string;
}

export interface IAIChatAppendMessagesInput {
  title?: string;
  summary?: string;
  messages: IAIChatMessage[];
}

export interface IAIChatRequest {
  requestId?: string;
  providerId?: string;
  model?: string;
  mentionedConnectionIds?: string[];
  messages: IAIChatMessageInput[];
}

export type IAIAppAction =
  | { type: 'refresh_workspace' }
  | { type: 'refresh_snippets' }
  | { type: 'reload_connection'; connectionId: string }
  | {
      type: 'create_theme';
      name: string;
      baseThemeName?: string;
      colors?: Record<string, string>;
    }
  | { type: 'update_theme_colors'; colors: Record<string, string> };

export interface IAIChatResponse {
  content: string;
  queryApprovals?: IAIQueryApproval[];
  appActions?: IAIAppAction[];
}

export interface ICodexChatGPTAccount {
  authenticated: boolean;
  email?: string | null;
  planType?: string | null;
  authMode?: string | null;
}

export interface ICodexChatGPTLoginStart {
  loginId: string;
  verificationUrl: string;
  userCode: string;
}
