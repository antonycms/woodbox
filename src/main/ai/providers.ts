import type { LanguageModel } from 'ai';
import { createAnthropic } from '@ai-sdk/anthropic';
import { createGoogle } from '@ai-sdk/google';
import { createOpenAI } from '@ai-sdk/openai';
import { createOpenAICompatible } from '@ai-sdk/openai-compatible';
import { decodeAIProviderSecret } from '@main/storage/modules/ai_providers';

export const resolveAIModel = (provider: IAIProviderConfig): LanguageModel => {
  const apiKey = decodeAIProviderSecret(provider.apiKey);
  const baseURL = provider.baseURL || undefined;

  if (!apiKey && provider.type !== 'openai-compatible') {
    throw new Error('Informe a chave de API do provedor de IA.');
  }

  if (provider.type === 'openai') {
    return createOpenAI({ apiKey, baseURL })(provider.model);
  }

  if (provider.type === 'anthropic') {
    return createAnthropic({ apiKey, baseURL })(provider.model);
  }

  if (provider.type === 'google') {
    return createGoogle({ apiKey, baseURL })(provider.model);
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
  })(provider.model);
};
