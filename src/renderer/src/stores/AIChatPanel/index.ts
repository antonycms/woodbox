import { create } from 'zustand';
import { generateHash } from '@shared/utils/string';
import type { IAIChatPanelStore } from './types';

export const useAIChatPanelStore = create<IAIChatPanelStore>()((set) => ({
  activeChatId: undefined,
  editorContextRequest: undefined,
  initialMessageRequest: undefined,
  visible: false,
  addEditorSelectionToChatContext: (input) =>
    set({ editorContextRequest: { ...input, id: generateHash() }, visible: true }),
  clearEditorContextRequest: () => set({ editorContextRequest: undefined }),
  startNewChatWithMessage: (content, contexts) =>
    set({
      activeChatId: undefined,
      initialMessageRequest: { content, contexts, id: generateHash() },
      visible: true,
    }),
  clearInitialMessageRequest: () => set({ initialMessageRequest: undefined }),
  openChatPanel: (chatId) => set({ activeChatId: chatId, visible: true }),
  closeChatPanel: () => set({ visible: false }),
  toggleChatPanel: () => set((state) => ({ visible: !state.visible })),
}));
