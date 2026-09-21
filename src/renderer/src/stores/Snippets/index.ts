import { create } from 'zustand';
import { generateHash } from '@shared/utils/string';
import { runPromiseOnce } from '@renderer/utils/promise';
import type { ISnippetsStore } from './types';

export const useSnippetsStore = create<ISnippetsStore>()((set, get) => ({
  snippets: [],
  initialize: runPromiseOnce(async () => {
    set({ snippets: await window.api.snippets.list() });
  }),

  addSnippet: async (data) => {
    await get().initialize();
    const snippet = { ...data, id: generateHash() };
    await window.api.snippets.add(snippet);
    set((state) => ({ snippets: [...state.snippets, snippet] }));
    return snippet;
  },

  editSnippet: async (id, data) => {
    await get().initialize();
    const snippet = { ...data, id };
    await window.api.snippets.edit(id, snippet);
    set((state) => ({
      snippets: state.snippets.map((item) => item.id === id ? snippet : item),
    }));
  },

  removeSnippet: async (id) => {
    await get().initialize();
    await window.api.snippets.remove(id);
    set((state) => ({ snippets: state.snippets.filter((snippet) => snippet.id !== id) }));
  },
}));
