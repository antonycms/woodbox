export interface IAIChatEditorContextRequest {
  id: string;
  content: string;
  language?: 'sql' | 'json';
}

export type IAIChatEditorContextInput = Omit<IAIChatEditorContextRequest, 'id'>;

export interface IAIChatInitialMessageRequest {
  id: string;
  content: string;
  contexts?: IAIChatInitialMessageContext[];
}

export interface IAIChatInitialMessageContext {
  title: string;
  content: string;
  language?: 'sql' | 'json';
}

export interface IAIChatPanelStore {
  activeChatId: string | undefined;
  editorContextRequest?: IAIChatEditorContextRequest;
  initialMessageRequest?: IAIChatInitialMessageRequest;
  visible: boolean;
  addEditorSelectionToChatContext(input: IAIChatEditorContextInput): void;
  clearEditorContextRequest(): void;
  startNewChatWithMessage(content: string, contexts?: IAIChatInitialMessageContext[]): void;
  clearInitialMessageRequest(): void;
  openChatPanel(chatId: string): void;
  closeChatPanel(): void;
  toggleChatPanel(): void;
}
