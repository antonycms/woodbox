import { generateText } from 'ai';
import { getCodexChatGPTAccount } from '@main/codex/account';
import { getInternalAIProvider } from '@main/storage/store';
import { sendCodexChatGPTMessage } from '@main/codex/chat';
import { resolveAIModel } from './providers';
import {
  AI_TOOL_STOP_CONDITION,
  buildAIDatabaseInstructions,
  createAIDatabaseTools,
} from './tools';

const WOODBOX_AI_INSTRUCTIONS = [
  'Você é o assistente de IA do Woodbox, um cliente desktop para bancos de dados.',
  'Responda em português brasileiro por padrão.',
  'Ajude com SQL, modelagem, diagnóstico de schema, otimização e migrações.',
  'Formate respostas em Markdown limpo: parágrafos curtos, listas quando houver itens e blocos ```sql``` para queries.',
  'Não invente dados do banco; peça contexto quando faltar informação.',
].join('\n');

const normalizeMessages = (messages: IAIChatMessageInput[]) => {
  return messages
    .filter((message) => !!message.content.trim())
    .map((message) => ({
      role: message.role,
      content: message.content,
    }));
};

export const sendAIChatMessage = async ({
  providerId,
  mentionedConnectionIds,
  messages,
}: IAIChatRequest): Promise<IAIChatResponse> => {
  const provider = getInternalAIProvider(providerId);

  if (!provider) {
    throw new Error('Configure um provedor de IA antes de enviar mensagens.');
  }

  if (provider.type === 'codex-chatgpt') {
    return await sendCodexChatGPTMessage(provider, { providerId, messages });
  }

  const model = resolveAIModel(provider);
  const normalizedMessages = normalizeMessages(messages);

  if (!normalizedMessages.length) {
    throw new Error('Informe uma mensagem para enviar ao assistente.');
  }

  const response = await generateText({
    model,
    instructions: [
      WOODBOX_AI_INSTRUCTIONS,
      buildAIDatabaseInstructions(mentionedConnectionIds),
    ].join('\n\n'),
    messages: normalizedMessages,
    tools: createAIDatabaseTools(mentionedConnectionIds),
    stopWhen: AI_TOOL_STOP_CONDITION,
    maxRetries: 1,

    onStepFinish: ({ toolResults }) => {
      for (let i = 0; i < toolResults?.length || 0; i++) {
        const { toolName, input, output } = toolResults[i];
        console.log({ toolName, input, output: JSON.stringify(output) });
      }
    },

    onFinish: ({ toolResults, usage, steps }) => {
      console.log(`[tools] ${toolResults.map(toolResult => toolResult.toolName)}`)
      console.log(`✅ Tokens — input: ${usage.inputTokens}, output: ${usage.outputTokens}`);
      console.log(`✅ Cache - cached: ${(usage.inputTokenDetails?.cacheReadTokens || 0) + (usage.inputTokenDetails?.cacheWriteTokens || 0)}, no-cached: ${usage.inputTokenDetails?.noCacheTokens || 0}`)
      console.log(`📊 Steps: ${steps.length}`);
    },
  });

  return { content: response.text };
};

export const testAIProvider = async (providerInput: IAIProviderInput) => {
  if (providerInput.type === 'codex-chatgpt') {
    const account = await getCodexChatGPTAccount();

    if (!account.authenticated) {
      throw new Error('Entre com ChatGPT antes de testar o provedor Codex.');
    }

    return true;
  }

  const storedProvider = providerInput.id ? getInternalAIProvider(providerInput.id) : undefined;

  const model = resolveAIModel({
    id: providerInput.id || 'test-provider',
    name: providerInput.name,
    type: providerInput.type,
    model: providerInput.model,
    apiKey: providerInput.apiKey || storedProvider?.apiKey,
    baseURL: providerInput.baseURL || storedProvider?.baseURL,
    isDefault: providerInput.isDefault,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString(),
  });

  await generateText({
    model,
    instructions: 'Responda apenas com OK.',
    prompt: 'Teste de conexão.',
    maxRetries: 0,
  });

  return true;
};
