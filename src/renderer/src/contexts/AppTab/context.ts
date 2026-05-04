import { createContext } from 'react';

export interface ITabContext {
  readonly tabs: IAppTab[];
  activeTabId: string | undefined;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | undefined>>;
  addTab(tab: INewAppTab): void;
  removeTab(tabId: string | string[]): void;
  moveTab(fromId: string, toId: string): void;
  getTab(tabId: string): IAppTab | undefined;
  updateTab(id: string, data: Partial<Pick<IAppTab, 'title' | 'subtitle' | 'unsaved'>>): void;
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
  replaceId?: string;
  title?: string;
  subtitle?: string;
  unsaved?: boolean;
  data?: IAppTabData;
  component(): React.ReactElement | null;
}

export interface IAppTab {
  id: string;
  title: string;
  subtitle?: string;
  unsaved?: boolean;
  data?: IAppTabData;
  component(): React.ReactElement | null;
}

export interface IAppTabsSession {
  tabs?: Array<Pick<IAppTab, 'id' | 'title' | 'subtitle' | 'unsaved'> & { data?: IAppTabData }>;
  activeTabId?: string;
}

export const APP_TABS_SESSION_STORAGE_KEY = 'app_tabs_session';

export default createContext<ITabContext>({} as any);
