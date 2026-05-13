import React from 'react';
import { ITabContext, TabContext } from './context';

interface ITabProviderProps {
  activeTabId: string | null;
  children?: React.ReactNode;
}

export default function TabProvider({ children, activeTabId }: ITabProviderProps) {
  const value = React.useMemo<ITabContext>(() => ({ activeTabId }), [activeTabId]);

  return <TabContext.Provider value={value}>{children}</TabContext.Provider>;
}

export const useTabContext = () => {
  return React.useContext(TabContext);
};
