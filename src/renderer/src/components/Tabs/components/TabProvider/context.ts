import { createContext } from 'react';

export interface ITabContext {
  activeTabId: string | null;
}

export const TabContext = createContext<ITabContext>({} as ITabContext);
