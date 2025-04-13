import React from 'react';
import { generateHash } from '@renderer/utils/string';

const AppTabContext = React.createContext<ITabContext>({} as any);

const AppTabProvider = ({ children }: { children: React.ReactNode }) => {
  const [tabs, setTabs] = React.useState<IAppTab[]>([]);
  const [activeTabId, setActiveTabId] = React.useState<string>();

  const addTab = (tabData: INewAppTab) => {
    const { id = generateHash(), unsaved = false, title = 'Sem titulo', component } = tabData;

    const tab: IAppTab = {
      id,
      title,
      unsaved,
      component: React.memo(component) as any,
    };

    setTabs((prevState) => [...prevState, tab]);
    setActiveTabId(tab.id);
  };

  const removeTab = (tabId: string) => {
    setTabs((prevState) => prevState.filter((tab) => tab.id !== tabId));
  };

  const getTab = (tabId: string) => {
    return tabs.find((tab) => tab.id === tabId);
  };

  return (
    <AppTabContext.Provider
      value={{
        tabs,
        addTab,
        removeTab,
        activeTabId,
        setActiveTabId,
        getTab,
      }}
    >
      {children}
    </AppTabContext.Provider>
  );
};

export const useAppTabContext = () => {
  return React.useContext(AppTabContext);
};

export default AppTabProvider;

interface ITabContext {
  readonly tabs: IAppTab[];
  activeTabId: string;
  setActiveTabId: React.Dispatch<React.SetStateAction<string>>;
  addTab(tab: INewAppTab): void;
  removeTab(tabId: string): void;
  getTab(tabId: string): IAppTab;
}

interface INewAppTab {
  id?: string;
  title?: string;
  unsaved?: boolean;
  component(): JSX.Element | null;
}

interface IAppTab {
  id: string;
  title: string;
  unsaved?: boolean;
  component(): JSX.Element | null;
}
