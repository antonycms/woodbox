import { createContext } from 'react';

export interface ITabContext {
  idTabBar: string;
  activeTabId: string | null;
}

export const TabContext = createContext<ITabContext>({} as ITabContext);
