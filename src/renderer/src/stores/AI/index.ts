import { create } from 'zustand';
import { runPromiseOnce } from '@renderer/utils/promise';
import type { IAIStore } from './types';

export const useAIStore = create<IAIStore>()((set, get) => ({
  aiProviders: [],
  aiChats: [],
  initialize: runPromiseOnce(async () => {
    const [aiProviders, aiChats] = await Promise.all([
      window.api.aiProviders.list(), window.api.aiChats.list(),
    ]);
    set({ aiProviders, aiChats });
  }),

  addAIProvider: async (data) => {
    await get().initialize();
    await window.api.aiProviders.add(data);
    set({ aiProviders: await window.api.aiProviders.list() });
  },

  editAIProvider: async (id, data) => {
    await get().initialize();
    await window.api.aiProviders.edit(id, data);
    set({ aiProviders: await window.api.aiProviders.list() });
  },

  removeAIProvider: async (id) => {
    await get().initialize();
    await window.api.aiProviders.remove(id);
    set({ aiProviders: await window.api.aiProviders.list() });
  },

  addAIChat: async (data) => {
    await get().initialize();
    const chat = await window.api.aiChats.add(data);
    set((state) => ({ aiChats: [chat, ...state.aiChats] }));
    return chat;
  },

  editAIChat: async (id, data) => {
    await get().initialize();
    await window.api.aiChats.edit(id, data);
    set({ aiChats: await window.api.aiChats.list() });
  },

  removeAIChat: async (id) => {
    await get().initialize();
    await window.api.aiChats.remove(id);
    set((state) => ({ aiChats: state.aiChats.filter((chat) => chat.id !== id) }));
  },

  appendAIChatMessages: async (id, data) => {
    await get().initialize();
    await window.api.aiChats.appendMessages(id, data);
    set({ aiChats: await window.api.aiChats.list() });
  },

  testAIProvider: (...args) => window.api.aiProviders.test(...args),
  sendAIChatMessage: (...args) => window.api.aiChats.sendMessage(...args),
  cancelAIChatMessage: (...args) => window.api.aiChats.cancelMessage(...args),
  getCodexChatGPTAccount: (...args) => window.api.codex.getAccount(...args),
  startCodexChatGPTLogin: (...args) => window.api.codex.startLogin(...args),
  logoutCodexChatGPT: (...args) => window.api.codex.logout(...args),
}));
