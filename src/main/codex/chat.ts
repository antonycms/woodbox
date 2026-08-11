import { app } from 'electron';
import { codexRpc } from './rpc';
import { getCodexChatGPTAccount } from './account';

type ThreadStartResponse = {
  thread: { id: string };
};

type TurnStartResponse = {
  turn: { id: string };
};

type AgentMessageDelta = {
  threadId: string;
  turnId: string;
  delta: string;
};

type TurnCompleted = {
  threadId: string;
  turn: {
    id: string;
    status: string;
    error?: { message?: string } | null;
    items?: { type: string; text?: string }[];
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

const waitForTurn = (threadId: string, turnId: string) => {
  let content = '';

  return new Promise<string>((resolve, reject) => {
    const timeout = setTimeout(() => {
      cleanup();
      reject(new Error('Tempo esgotado aguardando resposta do Codex.'));
    }, 180_000);

    const cleanupDelta = codexRpc.onNotification('item/agentMessage/delta', (params) => {
      const delta = params as AgentMessageDelta;

      if (delta.threadId !== threadId || delta.turnId !== turnId) return;

      content += delta.delta;
    });

    const cleanupCompleted = codexRpc.onNotification('turn/completed', (params) => {
      const completed = params as TurnCompleted;

      if (completed.threadId !== threadId || completed.turn.id !== turnId) return;

      cleanup();

      if (completed.turn.status === 'failed') {
        reject(new Error(completed.turn.error?.message || 'Codex falhou ao responder.'));
        return;
      }

      const finalMessage =
        content ||
        completed.turn.items
          ?.filter((item) => item.type === 'agentMessage')
          .map((item) => item.text)
          .filter(Boolean)
          .join('\n\n') ||
        '';

      resolve(finalMessage.trim());
    });

    const cleanup = () => {
      clearTimeout(timeout);
      cleanupDelta();
      cleanupCompleted();
    };
  });
};

export const sendCodexChatGPTMessage = async (
  _provider: IAIProviderConfig,
  request: IAIChatRequest,
): Promise<IAIChatResponse> => {
  const account = await getCodexChatGPTAccount();

  if (!account.authenticated) {
    throw new Error('Entre com ChatGPT no provedor Codex antes de enviar mensagens.');
  }

  const thread = await codexRpc.request<ThreadStartResponse>('thread/start', {
    model: request.model || null,
    cwd: app.getPath('userData'),
    approvalPolicy: 'never',
    sandbox: 'read-only',
    baseInstructions: WOODBOX_CODEX_INSTRUCTIONS,
    ephemeral: true,
    threadSource: 'woodbox',
  });

  const turn = await codexRpc.request<TurnStartResponse>('turn/start', {
    threadId: thread.thread.id,
    input: [
      {
        type: 'text',
        text: toPrompt(request.messages),
        text_elements: [],
      },
    ],
    approvalPolicy: 'never',
    sandboxPolicy: {
      type: 'readOnly',
      networkAccess: false,
    },
  });

  const content = await waitForTurn(thread.thread.id, turn.turn.id);

  return { content };
};
