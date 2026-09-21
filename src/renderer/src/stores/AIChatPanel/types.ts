export interface IAIChatEditorContextRequest {
  id: string;
  content: string;
  language?: 'sql' | 'json';
}

export type IAIChatEditorContextInput = Omit<IAIChatEditorContextRequest, 'id'>;

export interface IAIChatPanelStore {
  activeChatId: string | undefined;
  editorContextRequest?: IAIChatEditorContextRequest;
  visible: boolean;
  addEditorSelectionToChatContext(input: IAIChatEditorContextInput): void;
  clearEditorContextRequest(): void;
  openChatPanel(chatId: string): void;
  closeChatPanel(): void;
  toggleChatPanel(): void;
}
