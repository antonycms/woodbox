import React from 'react';
import { ITabContentContext, TabContentContext } from './context';

interface ITabProviderProps {
  activeTabId: string | null;
  tabId: string;
  children?: React.ReactNode;
}

export default function TabContentProvider({ children, activeTabId, tabId }: ITabProviderProps) {
  const value = React.useMemo<ITabContentContext>(
    () => ({ isActiveTab: activeTabId === tabId }),
    [activeTabId, tabId],
  );

  return <TabContentContext.Provider value={value}>{children}</TabContentContext.Provider>;
}

export const useTabContentContext = () => {
  return React.useContext(TabContentContext);
};
