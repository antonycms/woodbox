import { createContext } from 'react';

export interface ITabContext {
  readonly tabs: IAppTab[];
  activeTabId: string | undefined;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | undefined>>;
  addTab(tab: INewAppTab): void;
  restoreTabs(tabs: IAppTab[], activeTabId?: string): void;
  removeTab(tabId: string | string[]): void;
  moveTab(fromId: string, toId: string): void;
  getTab(tabId: string): IAppTab | undefined;
  updateTab(id: string, data: Partial<Pick<IAppTab, 'title' | 'unsaved'>>): void;
}

export type IAppTabData =
  | { type: 'query-editor'; id_connection: string; id_script?: string }
  | {
      type: 'table-info';
      id_connection: string;
      table: string;
      schema?: string;
      initialWhere?: string;
      filterLocked?: boolean;
      initialTab?: string;
    }
  | { type: 'function-info'; id_connection: string; schema: string; function_name: string };

export interface INewAppTab {
  id?: string;
  title?: string;
  unsaved?: boolean;
  data?: IAppTabData;
  component(): JSX.Element | null;
}

export interface IAppTab {
  id: string;
  title: string;
  unsaved?: boolean;
  data?: IAppTabData;
  component(): JSX.Element | null;
}

export default createContext<ITabContext>({} as any);
