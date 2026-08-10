import type Store from 'electron-store';
import { generateHash } from '@main/utils/methods';

const STORE_KEY = 'ai_chats';

export const initialValue = {
  type: 'array',
  default: [] as IAIChat[],
} as const;

const getChats = (store: Store<Record<string, unknown>>) =>
  (store.get(STORE_KEY) as IAIChat[] | undefined) ?? [];

const sortChats = (chats: IAIChat[]) =>
  [...chats].sort((a, b) => b.updated_at.localeCompare(a.updated_at));

const normalizeMessage = (message: IAIChatMessage): IAIChatMessage => ({
  id: message.id || generateHash(12),
  role: message.role,
  content: message.content,
  created_at: message.created_at || new Date().toISOString(),
  queryApprovals: message.queryApprovals,
  queryResult: message.queryResult,
});

const normalizeChat = (data: IAIChatInput): IAIChat => {
  const now = new Date().toISOString();

  return {
    id: data.id || generateHash(12),
    title: data.title.trim(),
    summary: data.summary?.trim() || '',
    messages: (data.messages || []).map(normalizeMessage),
    created_at: now,
    updated_at: now,
  };
};

export const getModule = (store: Store<Record<string, unknown>>) => {
  const get = () => sortChats(getChats(store));

  const add = (data: IAIChatInput) => {
    const chat = normalizeChat(data);

    store.set(STORE_KEY, sortChats([chat, ...getChats(store)]));

    return chat;
  };

  const edit = (id: string, data: IAIChatPatch) => {
    const chats = getChats(store);
    const index = chats.findIndex((chat) => chat.id === id);

    if (index === -1) {
      throw new Error(`Conversa de IA não encontrada: ${id}`);
    }

    chats[index] = {
      ...chats[index],
      title: data.title?.trim() || chats[index].title,
      summary: data.summary?.trim() ?? chats[index].summary,
      messages: data.messages ? data.messages.map(normalizeMessage) : chats[index].messages,
      updated_at: new Date().toISOString(),
    };

    store.set(STORE_KEY, sortChats(chats));
  };

  const appendMessages = (id: string, data: IAIChatAppendMessagesInput) => {
    const chats = getChats(store);
    const index = chats.findIndex((chat) => chat.id === id);

    if (index === -1) {
      throw new Error(`Conversa de IA não encontrada: ${id}`);
    }

    chats[index] = {
      ...chats[index],
      title: data.title?.trim() || chats[index].title,
      summary: data.summary?.trim() ?? chats[index].summary,
      messages: [...chats[index].messages, ...data.messages.map(normalizeMessage)],
      updated_at: new Date().toISOString(),
    };

    store.set(STORE_KEY, sortChats(chats));
  };

  const remove = (id: string) => {
    store.set(
      STORE_KEY,
      getChats(store).filter((chat) => chat.id !== id),
    );
  };

  return { get, add, edit, appendMessages, remove };
};
