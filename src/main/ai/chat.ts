import { generateText } from 'ai';
import { getCodexChatGPTAccount } from '@main/codex/account';
import { getInternalAIProvider } from '@main/storage/store';
import { sendCodexChatGPTMessage } from '@main/codex/chat';
import { resolveAIModel } from './providers';
import {
  AI_TOOL_STOP_CONDITION,
  AI_QUERY_EXECUTION_TOOL_NAME,
  buildAIDatabaseInstructions,
  createAIDatabaseTools,
  type AIQueryExecutionToolOutput,
} from './tools';

const WOODBOX_AI_INSTRUCTIONS = [
  'Você é o assistente de IA do Woodbox, um cliente desktop para bancos de dados.',
  'Responda em português brasileiro por padrão.',
  'Ajude com SQL, modelagem, diagnóstico de schema, otimização e migrações.',
  'Formate respostas em Markdown limpo: parágrafos curtos, listas quando houver itens e blocos ```sql``` apenas para exemplos, revisões ou sugestões.',
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

const isQueryExecutionToolOutput = (output: unknown): output is AIQueryExecutionToolOutput => {
  if (!output || typeof output !== 'object') return false;

  const queryApproval = (output as Partial<AIQueryExecutionToolOutput>).queryApproval;

  return !!queryApproval && typeof queryApproval.sql === 'string';
};

const extractQueryApprovalsFromToolResults = (
  toolResults: Array<{ toolName: string; output: unknown }>,
) => {
  const queryApprovals = new Map<string, IAIQueryApproval>();

  for (const toolResult of toolResults) {
    if (toolResult.toolName !== AI_QUERY_EXECUTION_TOOL_NAME) continue;
    if (!isQueryExecutionToolOutput(toolResult.output)) continue;

    queryApprovals.set(toolResult.output.queryApproval.id, toolResult.output.queryApproval);
  }

  return Array.from(queryApprovals.values());
};

const aiChatAbortControllers = new Map<string, AbortController>();

export const cancelAIChatMessage = (requestId: string) => {
  const controller = aiChatAbortControllers.get(requestId);

  if (!controller) return false;

  controller.abort();
  aiChatAbortControllers.delete(requestId);

  return true;
};

export const sendAIChatMessage = async ({
  requestId,
  providerId,
  model: selectedModel,
  mentionedConnectionIds,
  messages,
}: IAIChatRequest): Promise<IAIChatResponse> => {
  const provider = getInternalAIProvider(providerId);

  if (!provider) {
    throw new Error('Selecione um provedor de IA antes de enviar mensagens.');
  }

  if (!selectedModel) {
    throw new Error('Selecione um modelo de IA antes de enviar mensagens.');
  }

  const normalizedMessages = normalizeMessages(messages);

  if (!normalizedMessages.length) {
    throw new Error('Informe uma mensagem para enviar ao assistente.');
  }

  const tools = createAIDatabaseTools(mentionedConnectionIds);

  const instructions = [
    WOODBOX_AI_INSTRUCTIONS,
    buildAIDatabaseInstructions(mentionedConnectionIds),
  ].join('\n\n');

  // Conexao direta usando codex OAuth
  if (provider.type === 'codex-chatgpt') {
    return await sendCodexChatGPTMessage(provider, {
      requestId,
      providerId,
      model: selectedModel,
      mentionedConnectionIds,
      messages: normalizedMessages,
      instructions,
      tools,
    });
  }

  const model = resolveAIModel(provider, selectedModel);

  const abortController = requestId ? new AbortController() : undefined;

  if (requestId && abortController) {
    aiChatAbortControllers.set(requestId, abortController);
  }

  try {
    const response = await generateText({
      model,
      instructions,
      messages: normalizedMessages,
      tools,
      stopWhen: AI_TOOL_STOP_CONDITION,
      maxRetries: 1,
      abortSignal: abortController?.signal,

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

    return {
      content: response.text,
      queryApprovals: extractQueryApprovalsFromToolResults(response.toolResults),
    };
  } catch (error) {
    if (abortController?.signal.aborted) {
      return { content: '' };
    }

    throw error;
  } finally {
    if (requestId) aiChatAbortControllers.delete(requestId);
  }
};

export const testAIProvider = async (providerInput: IAIProviderInput) => {
  const firstModel = providerInput.models.map((model) => model.trim()).find(Boolean);

  if (!firstModel) {
    throw new Error('Informe ao menos um modelo de IA.');
  }

  if (providerInput.type === 'codex-chatgpt') {
    const account = await getCodexChatGPTAccount();

    if (!account.authenticated) {
      throw new Error('Entre com ChatGPT antes de testar o provedor Codex.');
    }

    return true;
  }

  const storedProvider = providerInput.id ? getInternalAIProvider(providerInput.id) : undefined;

  const model = resolveAIModel(
    {
      id: providerInput.id || 'test-provider',
      name: providerInput.name,
      type: providerInput.type,
      models: providerInput.models,
      apiKey: providerInput.apiKey || storedProvider?.apiKey,
      baseURL: providerInput.baseURL || storedProvider?.baseURL,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    },
    firstModel,
  );

  await generateText({
    model,
    instructions: 'Responda apenas com OK.',
    prompt: 'Teste de conexão.',
    maxRetries: 0,
  });

  return true;
};
