import React from 'react';

export interface ITabSplitContextValue {
  dragDataType: string;
  draggingTabId?: string;
  setDraggingTabId(tabId?: string): void;
}

export const TabSplitContext = React.createContext<ITabSplitContextValue | null>(null);

export const TabSplitProvider = TabSplitContext.Provider;

export const useTabSplitContext = () => React.useContext(TabSplitContext);
