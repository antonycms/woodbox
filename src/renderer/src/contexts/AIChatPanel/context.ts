import { createContext } from 'react';

export interface IAIChatEditorContextRequest {
  id: string;
  content: string;
  language?: 'sql' | 'json';
}

export type IAIChatEditorContextInput = Omit<IAIChatEditorContextRequest, 'id'>;

export interface IAIChatPanelContext {
  activeChatId: string | undefined;
  editorContextRequest?: IAIChatEditorContextRequest;
  visible: boolean;
  addEditorSelectionToChatContext(input: IAIChatEditorContextInput): void;
  clearEditorContextRequest(): void;
  openChatPanel(chatId: string): void;
  closeChatPanel(): void;
  toggleChatPanel(): void;
}

const noop = () => undefined;

export default createContext<IAIChatPanelContext>({
  activeChatId: undefined,
  editorContextRequest: undefined,
  visible: false,
  addEditorSelectionToChatContext: noop,
  clearEditorContextRequest: noop,
  openChatPanel: noop,
  closeChatPanel: noop,
  toggleChatPanel: noop,
});
