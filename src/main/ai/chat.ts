import type {
  IAIProviderInput,
  IAIChatMessageInput,
  IAIQueryApproval,
  IAIChatRequest,
  IAIChatResponse,
} from '@shared/types/ai';
import { generateText } from 'ai';
import { getCodexChatGPTAccount } from '../codex/account';
import { getInternalAIProvider } from '../storage/store';
import { sendCodexChatGPTMessage } from '../codex/chat';
import { resolveAIModel } from './providers';
import {
  AI_TOOL_STOP_CONDITION,
  AI_QUERY_EXECUTION_TOOL_NAME,
  getAIAppActionsFromToolOutput,
  buildAIDatabaseInstructions,
  createAIDatabaseTools,
  type AIQueryExecutionToolOutput,
} from './tools';

const getWoodboxAIInstructions = (language: IAIChatRequest['language']) => {
  if (language === 'en') {
    return [
      'You are the Woodbox AI assistant, a desktop database client.',
      'Respond in English by default.',
      'Help with SQL, modeling, schema diagnostics, optimization, and migrations.',
      'Format responses in clean Markdown: short paragraphs, lists when useful, and ```sql``` blocks only for examples, reviews, or suggestions.',
      'Do not invent database data; ask for context when information is missing.',
    ].join('\n');
  }

  return [
    'Você é o assistente de IA do Woodbox, um cliente desktop para bancos de dados.',
    'Responda em português brasileiro por padrão.',
    'Ajude com SQL, modelagem, diagnóstico de schema, otimização e migrações.',
    'Formate respostas em Markdown limpo: parágrafos curtos, listas quando houver itens e blocos ```sql``` apenas para exemplos, revisões ou sugestões.',
    'Não invente dados do banco; peça contexto quando faltar informação.',
  ].join('\n');
};

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

const extractAppActionsFromToolResults = (
  toolResults: Array<{ output: unknown }>,
) => toolResults.flatMap((toolResult) => getAIAppActionsFromToolOutput(toolResult.output));

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
  language,
  mentionedConnectionIds,
  activeThemeColors,
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

  const availableTools = createAIDatabaseTools(mentionedConnectionIds, activeThemeColors);
  const hasNoSelectedConnection = mentionedConnectionIds?.length === 0;
  const tools = hasNoSelectedConnection
    ? {
        list_theme_options: availableTools.list_theme_options,
        get_active_theme_colors: availableTools.get_active_theme_colors,
        create_theme: availableTools.create_theme,
        update_theme_colors: availableTools.update_theme_colors,
      }
    : availableTools;

  const instructions = [
    getWoodboxAIInstructions(language),
    language === 'en'
      ? 'For theme fields you already know, use get_active_theme_colors with exact paths to read or compare current values before editing. Use list_theme_options to discover valid fields and presets. For a whole-app theme, use a matching preset or adapt the main surfaces, not only the editor. For a targeted edit, change only the requested fields. If a theme tool rejects an input, correct it before describing the changes. After preparing a theme edit, briefly describe the requested change without claiming success or adding a disclaimer that it is unconfirmed: Woodbox reports the actual application result separately.'
      : 'Para ler ou comparar cores de campos conhecidos antes de editar, use get_active_theme_colors com os caminhos exatos. Use list_theme_options para descobrir campos válidos e presets. Para um tema completo, use um preset correspondente ou adapte as superfícies principais, não só o editor. Para um ajuste pontual, altere apenas os campos pedidos. Se a ferramenta rejeitar a entrada, corrija-a antes de descrever as mudanças. Após preparar uma edição de tema, descreva brevemente o ajuste solicitado, sem afirmar sucesso nem acrescentar que falta confirmação: o Woodbox informa separadamente o resultado real da aplicação.',
    hasNoSelectedConnection
      ? 'No database connection is selected. Ask the user to select one if the request needs database access.'
      : buildAIDatabaseInstructions(mentionedConnectionIds, language),
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
      appActions: extractAppActionsFromToolResults(response.toolResults),
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
