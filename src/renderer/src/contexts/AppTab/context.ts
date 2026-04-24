import { createContext } from 'react';

export interface ITabContext {
  readonly tabs: IAppTab[];
  activeTabId: string;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  addTab(tab: INewAppTab): void;
  removeTab(tabId: string): void;
  getTab(tabId: string): IAppTab;
  updateTab(id: string, data: Partial<Pick<IAppTab, 'title' | 'unsaved'>>): void;
}

export interface INewAppTab {
  id?: string;
  title?: string;
  unsaved?: boolean;
  component(): JSX.Element | null;
}

export interface IAppTab {
  id: string;
  title: string;
  unsaved?: boolean;
  component(): JSX.Element | null;
}

export default createContext<ITabContext>({} as any);
