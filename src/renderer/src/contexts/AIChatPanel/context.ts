import { createContext } from 'react';

export interface IAIChatPanelContext {
  activeChatId: string | undefined;
  visible: boolean;
  openChatPanel(chatId: string): void;
  closeChatPanel(): void;
  toggleChatPanel(): void;
}

const noop = () => undefined;

export default createContext<IAIChatPanelContext>({
  activeChatId: undefined,
  visible: false,
  openChatPanel: noop,
  closeChatPanel: noop,
  toggleChatPanel: noop,
});
