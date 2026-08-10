import { createContext } from 'react';

export interface ITabContext {
  readonly tabs: IAppTab[];
  readonly tabGroups: IAppTabGroup[];
  activeTabId: string | undefined;
  setActiveTabId: React.Dispatch<React.SetStateAction<string | undefined>>;
  addTab(tab: INewAppTab): void;
  removeTab(tabId: string | string[], options?: IRemoveAppTabOptions): void;
  reopenClosedTab(): void;
  moveTab(fromId: string, toId: string, placement?: IAppTabMovePlacement): void;
  createTabGroup(tabId: string): string;
  addTabToGroup(tabId: string, groupId: string, targetTabId?: string): void;
  removeTabFromGroup(tabId: string, targetTabId?: string): void;
  updateTabGroup(
    groupId: string,
    data: Partial<Pick<IAppTabGroup, 'title' | 'color' | 'collapsed'>>,
  ): void;
  ungroupTabGroup(groupId: string): void;
  closeTabGroup(groupId: string): void;
  getTab(tabId: string): IAppTab | undefined;
  updateTab(id: string, data: Partial<Pick<IAppTab, 'title' | 'subtitle' | 'unsaved'>>): void;
}

export type IAppTabMovePlacement = 'before' | 'after';

export interface IRemoveAppTabOptions {
  keepHistory?: boolean;
}

export interface IAppTabGroup {
  id: string;
  title: string;
  color: string;
  collapsed?: boolean;
}

export type IAppTabData =
  | { type: 'query-editor'; id_connection: string; id_script: string; name: string }
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
  groupId?: string;
  title?: string;
  subtitle?: string;
  unsaved?: boolean;
  data?: IAppTabData;
  component(): React.ReactElement | null;
}

export interface IAppTab {
  id: string;
  groupId?: string;
  title: string;
  subtitle?: string;
  unsaved?: boolean;
  data?: IAppTabData;
  component(): React.ReactElement | null;
}

export interface IAppTabsSession {
  tabs?: Array<
    Pick<IAppTab, 'id' | 'groupId' | 'title' | 'subtitle' | 'unsaved'> & { data?: IAppTabData }
  >;
  tabGroups?: IAppTabGroup[];
  activeTabId?: string;
}

export const APP_TABS_SESSION_STORAGE_KEY = 'app_tabs_session';

export default createContext<ITabContext>({} as any);
