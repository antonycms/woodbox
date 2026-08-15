import React from 'react';
import { generateHash } from '@renderer/utils/string';
import AIChatPanelContext, { type IAIChatPanelContext } from './context';

export type * from './context';

const AIChatPanelProvider = ({ children }: { children: React.ReactNode }) => {
  const [activeChatId, setActiveChatId] = React.useState<string>();
  const [editorContextRequest, setEditorContextRequest] =
    React.useState<IAIChatPanelContext['editorContextRequest']>();
  const [visible, setVisible] = React.useState(false);

  const addEditorSelectionToChatContext = React.useCallback<
    IAIChatPanelContext['addEditorSelectionToChatContext']
  >((input) => {
    setEditorContextRequest({ ...input, id: generateHash() });
    setVisible(true);
  }, []);

  const clearEditorContextRequest = React.useCallback(() => {
    setEditorContextRequest(undefined);
  }, []);

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
      editorContextRequest,
      visible,
      addEditorSelectionToChatContext,
      clearEditorContextRequest,
      openChatPanel,
      closeChatPanel,
      toggleChatPanel,
    }),
    [
      activeChatId,
      addEditorSelectionToChatContext,
      clearEditorContextRequest,
      closeChatPanel,
      editorContextRequest,
      openChatPanel,
      toggleChatPanel,
      visible,
    ],
  );

  return <AIChatPanelContext.Provider value={contextValue}>{children}</AIChatPanelContext.Provider>;
};

export const useAIChatPanelContext = () => {
  return React.useContext(AIChatPanelContext);
};

export default AIChatPanelProvider;
