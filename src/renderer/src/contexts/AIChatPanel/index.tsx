import React from 'react';
import AIChatPanelContext, { type IAIChatPanelContext } from './context';

export type * from './context';

const AIChatPanelProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeChatId, setActiveChatId] = React.useState<string>();
  const [visible, setVisible] = React.useState(false);

  const openChatPanel = React.useCallback((chatId: string) => {
    setActiveChatId(chatId);
    setVisible(true);
  }, []);

  const closeChatPanel = React.useCallback(() => {
    setVisible(false);
  }, []);

  const toggleChatPanel = React.useCallback(() => {
    setVisible((prevState) => !prevState);
  }, []);

  const contextValue = React.useMemo<IAIChatPanelContext>(
    () => ({
      activeChatId,
      visible,
      openChatPanel,
      closeChatPanel,
      toggleChatPanel,
    }),
    [activeChatId, closeChatPanel, openChatPanel, toggleChatPanel, visible],
  );

  return <AIChatPanelContext.Provider value={contextValue}>{children}</AIChatPanelContext.Provider>;
};

export const useAIChatPanelContext = () => {
  return React.useContext(AIChatPanelContext);
};

export default AIChatPanelProvider;
