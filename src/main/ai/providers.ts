import type { LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

export const resolveAIModel = (provider: IAIProviderConfig, model: string): LanguageModel => {
  const apiKey = provider.apiKey || '';
  const baseURL = provider.baseURL || undefined;

  if (!apiKey && provider.type !== 'openai-compatible') {
    throw new Error('Informe a chave de API do provedor de IA.');
  }

  if (provider.type === 'openai') {
    return createOpenAI({ apiKey, baseURL })(model);
  }

  if (provider.type === 'anthropic') {
    return createAnthropic({ apiKey, baseURL })(model);
  }

  if (provider.type === 'google') {
    return createGoogle({ apiKey, baseURL })(model);
  }

  if (provider.type === 'openrouter') {
    return createOpenRouter({ apiKey, baseURL })(model);
  }

  if (provider.type === 'codex-chatgpt') {
    throw new Error('Provider Codex deve usar o Codex App Server.');
  }

  if (!baseURL) {
    throw new Error('Informe a URL base do provedor OpenAI compatível.');
  }

  return createOpenAICompatible({
    name: provider.id,
    apiKey,
    baseURL,
    includeUsage: true,
  })(model);
};
