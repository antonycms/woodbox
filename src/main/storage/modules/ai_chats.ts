import type Store from 'electron-store';
import { removeChatImage, storeChatImage } from '../aiChatImages';
import { generateHash } from '@shared/utils/string';
import type {
  IAIChatMessage,
  IAIChat,
  IAIChatInput,
  IAIChatPatch,
  IAIChatAppendMessagesInput,
} from '@shared/types/ai';

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
  image: message.role === 'user' && message.image
    ? { id: message.image.id, name: message.image.name, mimeType: message.image.mimeType }
    : undefined,
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
    providerId: data.providerId,
    model: data.model,
    connectionId: data.connectionId,
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
      providerId: data.providerId ?? chats[index].providerId,
      model: data.model ?? chats[index].model,
      connectionId: data.connectionId ?? chats[index].connectionId,
      updated_at: new Date().toISOString(),
    };

    store.set(STORE_KEY, sortChats(chats));
  };

  const appendMessages = async (id: string, data: IAIChatAppendMessagesInput) => {
    const writtenImages: string[] = [];

    try {
      for (const message of data.messages) {
        if (message.role !== 'user' || !message.image?.data) continue;
        await storeChatImage(message.image);
        writtenImages.push(message.image.id);
      }

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
    } catch (error) {
      await Promise.allSettled(writtenImages.map(removeChatImage));
      throw error;
    }
  };

  const remove = async (id: string) => {
    const chats = getChats(store);
    const chat = chats.find((item) => item.id === id);
    store.set(STORE_KEY, chats.filter((item) => item.id !== id));
    const images = chat?.messages.flatMap((message) => message.image ? [message.image.id] : []) ?? [];
    await Promise.allSettled(images.map(removeChatImage));
  };

  return { get, add, edit, appendMessages, remove };
};
