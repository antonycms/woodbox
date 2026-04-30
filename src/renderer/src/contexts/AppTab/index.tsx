import React from 'react';
import { generateHash } from '@renderer/utils/string';
import AppTabContext, { type IAppTab, type INewAppTab } from './context';
export type * from './context';

const AppTabProvider = ({ children }: { children: React.ReactNode }) => {
  const [tabs, setTabs] = React.useState<IAppTab[]>([]);
  const [activeTabId, setActiveTabId] = React.useState<string>();

  const addTab = React.useCallback((tabData: INewAppTab) => {
    const { id = generateHash(), unsaved = false, title = 'Sem titulo', component } = tabData;

    const tab: IAppTab = {
      id,
      title,
      unsaved,
      component: React.memo(component) as any,
    };

    setTabs((prevState) => [...prevState, tab]);
    setActiveTabId(tab.id);
  }, []);

  const removeTab = React.useCallback(
    (tabId: string | string[]) => {
      const tabsIdToRemove = new Set(Array.isArray(tabId) ? tabId : [tabId]);

      if (tabsIdToRemove.has(activeTabId)) {
        const activeIndex = tabs.findIndex((t) => t.id === activeTabId);

        let nextId: string | undefined;

        for (let i = activeIndex - 1; i >= 0; i--) {
          if (!tabsIdToRemove.has(tabs[i].id)) {
            nextId = tabs[i].id;
            break;
          }
        }

        if (!nextId) {
          for (let i = activeIndex + 1; i < tabs.length; i++) {
            if (!tabsIdToRemove.has(tabs[i].id)) {
              nextId = tabs[i].id;
              break;
            }
          }
        }

        setActiveTabId(nextId);
      }

      setTabs((prev) => prev.filter((t) => !tabsIdToRemove.has(t.id)));
    },
    [tabs, activeTabId],
  );

  const moveTab = React.useCallback((fromId: string, toId: string) => {
    setTabs((prev) => {
      const fromIndex = prev.findIndex((tab) => tab.id === fromId);
      const toIndex = prev.findIndex((tab) => tab.id === toId);

      if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return prev;

      const next = [...prev];
      const [movedTab] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, movedTab);

      return next;
    });
  }, []);

  const getTab = (tabId: string) => {
    return tabs.find((tab) => tab.id === tabId);
  };

  const updateTab = React.useCallback(
    (id: string, data: Partial<Pick<IAppTab, 'title' | 'unsaved'>>) => {
      setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    },
    [],
  );

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key === 'w' && activeTabId) {
        e.preventDefault();
        removeTab(activeTabId);
      }
    };

    window.addEventListener('keydown', handleKeyDown);

    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, removeTab]);

  return (
    <AppTabContext.Provider
      value={{
        tabs,
        addTab,
        removeTab,
        moveTab,
        activeTabId,
        setActiveTabId,
        getTab,
        updateTab,
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
