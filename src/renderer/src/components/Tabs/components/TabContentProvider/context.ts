import { createContext } from 'react';

export interface ITabContentContext {
  isActiveTab: boolean;
}

export const TabContentContext = createContext<ITabContentContext>({} as ITabContentContext);
