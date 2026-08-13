import { getValidCodexCredential } from './account';

type CodexResponseEvent = {
  type?: string;
  delta?: string;
  item?: {
    type?: string;
    content?: { type?: string; text?: string }[];
  };
  response?: {
    output?: {
      type?: string;
      content?: { type?: string; text?: string }[];
    }[];
  };
  error?: {
    message?: string;
  };
};

const WOODBOX_CODEX_INSTRUCTIONS = [
  'Você é o assistente de IA do Woodbox, um cliente desktop para bancos de dados.',
  'Responda em português brasileiro por padrão.',
  'Ajude com SQL, modelagem, diagnóstico de schema, otimização e migrações.',
  'Formate respostas em Markdown limpo: parágrafos curtos, listas quando houver itens e blocos ```sql``` para queries.',
  'Não altere arquivos, não execute comandos e não use ferramentas. Responda apenas no chat.',
  'Não invente dados do banco; peça contexto quando faltar informação.',
].join('\n');

const toPrompt = (messages: IAIChatMessageInput[]) =>
  messages
    .map((message) => {
      const role = message.role === 'assistant' ? 'Assistente' : 'Usuário';

      return `${role}: ${message.content}`;
    })
    .join('\n\n');

const CODEX_API_ENDPOINT = 'https://chatgpt.com/backend-api/codex/responses';
const CODEX_CLIENT_VERSION = '0.144.1';

const extractTextFromResponse = (event: CodexResponseEvent) => {
  return event.response?.output
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

const readCodexSseResponse = async (response: Response) => {
  if (!response.body) {
    throw new Error('Codex não retornou corpo de resposta.');
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';
  let deltaContent = '';
  let finalContent = '';

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

    if (event.type?.includes('delta') && event.delta) {
      deltaContent += event.delta;
    }

    finalContent ||= extractTextFromItem(event);
    finalContent ||= extractTextFromResponse(event) || '';
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

  return (deltaContent || finalContent).trim();
};

export const sendCodexChatGPTMessage = async (
  _provider: IAIProviderConfig,
  request: IAIChatRequest,
): Promise<IAIChatResponse> => {
  const credential = await getValidCodexCredential();

  if (!credential) {
    throw new Error('Entre com ChatGPT no provedor Codex antes de enviar mensagens.');
  }

  const sessionId = request.requestId || crypto.randomUUID();
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
    body: JSON.stringify({
      model: request.model,
      instructions: WOODBOX_CODEX_INSTRUCTIONS,
      input: [{ role: 'user', content: toPrompt(request.messages) }],
      store: false,
      stream: true,
    }),
  });

  if (!response.ok) {
    const error = await response.text();

    throw new Error(`Codex falhou (${response.status}): ${error || response.statusText}`);
  }

  const content = await readCodexSseResponse(response);

  return { content };
};
