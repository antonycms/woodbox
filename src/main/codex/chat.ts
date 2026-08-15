import { asSchema, type Tool, type ToolSet } from 'ai';
import {
  AI_QUERY_EXECUTION_TOOL_NAME,
  type AIQueryExecutionToolOutput,
} from '@main/ai/tools';
import { getValidCodexCredential } from './account';

type CodexTextContent = { type?: string; text?: string };
type CodexInputTextContent = { type: 'input_text'; text: string };
type CodexOutputTextContent = { type: 'output_text'; text: string };
type CodexMessageItem = {
  type: 'message';
  role: 'user' | 'assistant' | 'developer';
  content: (CodexInputTextContent | CodexOutputTextContent)[];
};
type CodexFunctionCallItem = {
  type: 'function_call';
  call_id: string;
  name: string;
  arguments: string;
};
type CodexFunctionCallOutputItem = {
  type: 'function_call_output';
  call_id: string;
  output: string;
};
type CodexInputItem = CodexMessageItem | CodexFunctionCallItem | CodexFunctionCallOutputItem;
type CodexOutputItem = {
  type?: string;
  call_id?: string;
  name?: string;
  arguments?: string;
  content?: CodexTextContent[];
};
type CodexToolDefinition = {
  type: 'function';
  name: string;
  description: string;
  parameters: unknown;
  strict?: boolean;
};
type CodexToolCall = {
  call_id: string;
  name: string;
  arguments: string;
};
type CodexStepResult = {
  text: string;
  toolCalls: CodexToolCall[];
};
type CodexChatGPTRequest = IAIChatRequest & {
  instructions: string;
  tools?: ToolSet;
};
type CodexExecutableTool = Tool & {
  execute?: (
    input: unknown,
    options: {
      toolCallId: string;
      messages: [];
      abortSignal?: AbortSignal;
    },
  ) => unknown | PromiseLike<unknown> | AsyncIterable<unknown>;
};

type CodexResponseEvent = {
  type?: string;
  delta?: string;
  output_index?: number;
  call_id?: string;
  name?: string;
  arguments?: string;
  item?: CodexOutputItem;
  response?: {
    output?: CodexOutputItem[];
  };
  error?: {
    message?: string;
  };
};

const CODEX_API_ENDPOINT = 'https://chatgpt.com/backend-api/codex/responses';
const CODEX_CLIENT_VERSION = '0.144.1';
const MAX_CODEX_TOOL_STEPS = 6;

const toCodexMessageContent = (
  message: IAIChatMessageInput,
): (CodexInputTextContent | CodexOutputTextContent)[] => {
  if (message.role === 'assistant') {
    return [{ type: 'output_text', text: message.content }];
  }

  return [{ type: 'input_text', text: message.content }];
};

const toCodexInput = (messages: IAIChatMessageInput[]): CodexInputItem[] =>
  messages.map((message) => ({
    type: 'message',
    role: message.role,
    content: toCodexMessageContent(message),
  }));

const stringifyToolOutput = (output: unknown) => {
  if (typeof output === 'string') return output;

  try {
    return JSON.stringify(output);
  } catch {
    return String(output);
  }
};

const parseToolInput = (input: string) => {
  if (!input.trim()) return {};

  return JSON.parse(input) as Record<string, unknown>;
};

const getErrorMessage = (error: unknown) => {
  if (error instanceof Error) return error.message;

  return String(error);
};

const isQueryExecutionToolOutput = (output: unknown): output is AIQueryExecutionToolOutput => {
  if (!output || typeof output !== 'object') return false;

  const queryApproval = (output as Partial<AIQueryExecutionToolOutput>).queryApproval;

  return !!queryApproval && typeof queryApproval.sql === 'string';
};

const isAsyncIterable = (value: unknown): value is AsyncIterable<unknown> => {
  return !!value && typeof value === 'object' && Symbol.asyncIterator in value;
};

const resolveToolDescription = (tool: CodexExecutableTool) => {
  if (typeof tool.description === 'string') return tool.description;

  return '';
};

const toCodexTools = async (tools?: ToolSet): Promise<CodexToolDefinition[] | undefined> => {
  const entries = Object.entries(tools || {});

  if (!entries.length) return undefined;

  const definitions: CodexToolDefinition[] = [];

  for (const [name, tool] of entries) {
    if (tool.type === 'provider') continue;

    const executableTool = tool as CodexExecutableTool;

    definitions.push({
      type: 'function',
      name,
      description: resolveToolDescription(executableTool),
      parameters: await asSchema(executableTool.inputSchema).jsonSchema,
      ...(executableTool.strict !== undefined ? { strict: executableTool.strict } : {}),
    });
  }

  return definitions.length ? definitions : undefined;
};

const executeCodexTool = async (
  tools: ToolSet | undefined,
  toolCall: CodexToolCall,
): Promise<unknown> => {
  const tool = tools?.[toolCall.name] as CodexExecutableTool | undefined;

  if (!tool?.execute) {
    return { error: `Ferramenta não disponível: ${toolCall.name}` };
  }

  try {
    const input = parseToolInput(toolCall.arguments);
    const result = tool.execute(input, {
      toolCallId: toolCall.call_id,
      messages: [],
    });

    if (isAsyncIterable(result)) {
      let output: unknown;

      for await (const item of result) {
        output = item;
      }

      return output;
    }

    return await result;
  } catch (error) {
    return { error: getErrorMessage(error) };
  }
};

const extractTextFromOutput = (output?: CodexOutputItem[]) => {
  return output
    ?.flatMap((item) => item.content || [])
    .map((content) => content.text)
    .filter(Boolean)
    .join('');
};

const extractTextFromItem = (event: CodexResponseEvent) => {
  if (event.item?.type !== 'message') return '';

  return event.item.content
    ?.map((content) => content.text)
    .filter(Boolean)
    .join('') || '';
};

const extractToolCallsFromOutput = (output?: CodexOutputItem[]) => {
  const toolCalls = new Map<string, CodexToolCall>();

  for (const item of output || []) {
    if (item.type !== 'function_call' || !item.name) continue;

    const callId = item.call_id || crypto.randomUUID();

    toolCalls.set(callId, {
      call_id: callId,
      name: item.name,
      arguments: item.arguments || '',
    });
  }

  return Array.from(toolCalls.values());
};

const readCodexSseResponse = async (response: Response): Promise<CodexStepResult> => {
  if (!response.body) {
    throw new Error('Codex não retornou corpo de resposta.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let deltaContent = '';
  let finalContent = '';
  let finalOutput: CodexOutputItem[] | undefined;
  const toolCalls = new Map<string, CodexToolCall>();
  const toolCallIdByOutputIndex = new Map<number, string>();

  const handleBlock = (block: string) => {
    const data = block
      .split('\n')
      .filter((line) => line.startsWith('data:'))
      .map((line) => line.slice(5).trim())
      .join('\n');

    if (!data || data === '[DONE]') return;

    const event = JSON.parse(data) as CodexResponseEvent;

    if (event.error) {
      throw new Error(event.error.message || 'Codex falhou ao responder.');
    }

    const isTextDelta = event.type?.includes('output_text') || event.type?.includes('message');

    if (isTextDelta && event.delta) {
      deltaContent += event.delta;
    }

    finalContent ||= extractTextFromItem(event);
    finalContent ||= extractTextFromOutput(event.response?.output) || '';

    if (event.response?.output) {
      finalOutput = event.response.output;
    }

    if (event.item?.type === 'function_call' && event.item.name) {
      const callId = event.item.call_id || event.call_id || crypto.randomUUID();

      toolCalls.set(callId, {
        call_id: callId,
        name: event.item.name,
        arguments: event.item.arguments || '',
      });

      if (typeof event.output_index === 'number') {
        toolCallIdByOutputIndex.set(event.output_index, callId);
      }
    }

    if (event.type?.includes('function_call_arguments')) {
      const callId =
        event.call_id ||
        (typeof event.output_index === 'number'
          ? toolCallIdByOutputIndex.get(event.output_index)
          : undefined);
      const existing = callId ? toolCalls.get(callId) : undefined;

      if (existing && event.delta) {
        existing.arguments += event.delta;
      }

      if (existing && event.arguments !== undefined) {
        existing.arguments = event.arguments;
      }
    }
  };

  while (true) {
    const { done, value } = await reader.read();

    if (done) break;

    buffer += decoder.decode(value, { stream: true });

    const blocks = buffer.split(/\r?\n\r?\n/);
    buffer = blocks.pop() || '';
    blocks.forEach(handleBlock);
  }

  if (buffer.trim()) handleBlock(buffer);

  const finalToolCalls = extractToolCallsFromOutput(finalOutput);

  for (const toolCall of finalToolCalls) {
    toolCalls.set(toolCall.call_id, toolCall);
  }

  return {
    text: (deltaContent || finalContent || extractTextFromOutput(finalOutput) || '').trim(),
    toolCalls: Array.from(toolCalls.values()),
  };
};

const createCodexResponse = async ({
  credential,
  sessionId,
  model,
  instructions,
  input,
  tools,
}: {
  credential: Awaited<ReturnType<typeof getValidCodexCredential>>;
  sessionId: string;
  model: string;
  instructions: string;
  input: CodexInputItem[];
  tools?: CodexToolDefinition[];
}) => {
  if (!credential) {
    throw new Error('Entre com ChatGPT no provedor Codex antes de enviar mensagens.');
  }

  const body: Record<string, unknown> = {
    model,
    instructions,
    input,
    store: false,
    stream: true,
    include: ['reasoning.encrypted_content'],
  };

  if (tools?.length) {
    body.tools = tools;
    body.tool_choice = 'auto';
    body.parallel_tool_calls = false;
  }

  const headers = new Headers({
    accept: 'text/event-stream',
    authorization: `Bearer ${credential.accessToken}`,
    'content-type': 'application/json',
    'OpenAI-Beta': 'responses=experimental',
    originator: 'woodbox',
    version: CODEX_CLIENT_VERSION,
    conversation_id: sessionId,
    session_id: sessionId,
    'session-id': sessionId,
  });

  if (credential.accountId) {
    headers.set('chatgpt-account-id', credential.accountId);
  }

  const response = await fetch(CODEX_API_ENDPOINT, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  });

  if (!response.ok) {
    const error = await response.text();

    throw new Error(`Codex falhou (${response.status}): ${error || response.statusText}`);
  }

  return await readCodexSseResponse(response);
};

export const sendCodexChatGPTMessage = async (
  _provider: IAIProviderConfig,
  request: CodexChatGPTRequest,
): Promise<IAIChatResponse> => {
  const credential = await getValidCodexCredential();

  if (!credential) {
    throw new Error('Entre com ChatGPT no provedor Codex antes de enviar mensagens.');
  }

  if (!request.model) {
    throw new Error('Selecione um modelo de IA antes de enviar mensagens.');
  }

  const sessionId = request.requestId || crypto.randomUUID();
  const tools = await toCodexTools(request.tools);
  const input = toCodexInput(request.messages);
  let latestText = '';
  const queryApprovals = new Map<string, IAIQueryApproval>();

  for (let step = 0; step < MAX_CODEX_TOOL_STEPS; step++) {
    const result = await createCodexResponse({
      credential,
      sessionId,
      model: request.model,
      instructions: request.instructions,
      input,
      tools,
    });

    if (result.text) latestText = result.text;

    if (!result.toolCalls.length) {
      return {
        content: result.text,
        queryApprovals: Array.from(queryApprovals.values()),
      };
    }

    for (const toolCall of result.toolCalls) {
      const output = await executeCodexTool(request.tools, toolCall);

      if (
        toolCall.name === AI_QUERY_EXECUTION_TOOL_NAME &&
        isQueryExecutionToolOutput(output)
      ) {
        queryApprovals.set(output.queryApproval.id, output.queryApproval);
      }

      console.log({
        toolName: toolCall.name,
        input: toolCall.arguments,
        output: stringifyToolOutput(output),
      });

      input.push(
        {
          type: 'function_call',
          call_id: toolCall.call_id,
          name: toolCall.name,
          arguments: toolCall.arguments,
        },
        {
          type: 'function_call_output',
          call_id: toolCall.call_id,
          output: stringifyToolOutput(output),
        },
      );
    }
  }

  return {
    content:
      latestText ||
      'O Codex atingiu o limite de chamadas de ferramentas antes de concluir a resposta.',
    queryApprovals: Array.from(queryApprovals.values()),
  };
};
