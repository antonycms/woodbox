import React from 'react';
import { generateHash } from '@renderer/utils/string';
import AppTabContext, {
  type IAppTab,
  type IAppTabGroup,
  type IAppTabMovePlacement,
  type INewAppTab,
} from './context';
import { useSaveTabsOnStorage } from './hooks/useSaveTabsOnStorage';
import { useRestoreTabsFromStorage } from './hooks/useRestoreTabsFromStorage';
export type * from './context';

const TAB_GROUP_COLORS = [
  '#8ab4f8',
  '#f28b82',
  '#fdd663',
  '#81c995',
  '#c58af9',
  '#78d9ec',
  '#f6aea9',
  '#fbbc04',
];

const moveTabInList = (
  tabs: IAppTab[],
  fromId: string,
  toId: string,
  placement: IAppTabMovePlacement = 'before',
) => {
  const fromIndex = tabs.findIndex((tab) => tab.id === fromId);
  const toIndex = tabs.findIndex((tab) => tab.id === toId);

  if (fromIndex < 0 || toIndex < 0 || fromIndex === toIndex) return tabs;

  const next = [...tabs];
  const [movedTab] = next.splice(fromIndex, 1);
  const nextToIndex = next.findIndex((tab) => tab.id === toId);
  const insertIndex = placement === 'after' ? nextToIndex + 1 : nextToIndex;

  next.splice(insertIndex, 0, movedTab);

  return next;
};

const cleanupEmptyGroups = (groups: IAppTabGroup[], tabs: IAppTab[]) => {
  const groupIdsWithTabs = new Set(tabs.map((tab) => tab.groupId).filter(Boolean));

  return groups.filter((group) => groupIdsWithTabs.has(group.id));
};

const AppTabProvider = ({ children }: { children: React.ReactNode }) => {
  const [tabs, setTabs] = React.useState<IAppTab[]>([]);
  const [tabGroups, setTabGroups] = React.useState<IAppTabGroup[]>([]);
  const [activeTabId, setActiveTabId] = React.useState<string>();

  const addTab = React.useCallback(
    (tabData: INewAppTab) => {
      const {
        id = generateHash(),
        replaceId,
        groupId,
        unsaved = false,
        title = 'Sem titulo',
        subtitle,
        data,
        component,
      } = tabData;

      const tab: IAppTab = {
        id,
        groupId,
        title,
        subtitle,
        unsaved,
        data,
        component: React.memo(component) as any,
      };

      setTabs((prevState) => {
        const tabsIndex = new Map(prevState.map((t, i) => [t.id, i]));

        const activeTabIndex = tabsIndex.get(activeTabId) ?? -1;
        const replaceTabIndex = tabsIndex.get(replaceId) ?? -1;

        const newState = [...prevState];

        const insertAfterActiveTab = () => {
          if (activeTabIndex < 0) newState.push(tab);
          else newState.splice(activeTabIndex + 1, 0, tab);

          return newState;
        };

        if (!replaceId || replaceTabIndex < 0) return insertAfterActiveTab();

        const existingTarget = tabsIndex.get(id) >= 0;

        if (existingTarget && id !== replaceId) {
          newState.splice(replaceTabIndex, 1);
        } else {
          newState[replaceTabIndex] = tab;
        }

        return newState;
      });
      setActiveTabId(tab.id);
    },
    [activeTabId],
  );

  const removeTab = React.useCallback(
    (tabId: string | string[]) => {
      const tabsIdToRemove = new Set(Array.isArray(tabId) ? tabId : [tabId]);
      const remainingTabs = tabs.filter((t) => !tabsIdToRemove.has(t.id));
      const isVisible = (tab: IAppTab) => {
        const group = tabGroups.find((item) => item.id === tab.groupId);

        return !group?.collapsed;
      };

      if (tabsIdToRemove.has(activeTabId)) {
        const activeIndex = tabs.findIndex((t) => t.id === activeTabId);

        let nextId: string | undefined;

        for (let i = activeIndex - 1; i >= 0; i--) {
          if (!tabsIdToRemove.has(tabs[i].id) && isVisible(tabs[i])) {
            nextId = tabs[i].id;
            break;
          }
        }

        if (!nextId) {
          for (let i = activeIndex + 1; i < tabs.length; i++) {
            if (!tabsIdToRemove.has(tabs[i].id) && isVisible(tabs[i])) {
              nextId = tabs[i].id;
              break;
            }
          }
        }

        if (!nextId && remainingTabs[0]) {
          nextId = remainingTabs[0].id;

          if (remainingTabs[0].groupId) {
            setTabGroups((prev) =>
              prev.map((group) =>
                group.id === remainingTabs[0].groupId ? { ...group, collapsed: false } : group,
              ),
            );
          }
        }

        setActiveTabId(nextId);
      }

      setTabs((prev) => prev.filter((t) => !tabsIdToRemove.has(t.id)));
      setTabGroups((prev) => cleanupEmptyGroups(prev, remainingTabs));
    },
    [tabs, tabGroups, activeTabId],
  );

  const moveTab = React.useCallback(
    (fromId: string, toId: string, placement: IAppTabMovePlacement = 'before') => {
      setTabs((prev) => moveTabInList(prev, fromId, toId, placement));
    },
    [],
  );

  const createTabGroup = React.useCallback(
    (tabId: string) => {
      const group: IAppTabGroup = {
        id: generateHash(),
        title: 'Grupo',
        color: TAB_GROUP_COLORS[tabGroups.length % TAB_GROUP_COLORS.length],
      };

      setTabGroups((prev) => [...prev, group]);
      setTabs((prev) =>
        prev.map((tab) => (tab.id === tabId ? { ...tab, groupId: group.id } : tab)),
      );

      return group.id;
    },
    [tabGroups.length],
  );

  const addTabToGroup = React.useCallback(
    (tabId: string, groupId: string, targetTabId?: string) => {
      if (tabId === activeTabId) {
        setTabGroups((prev) =>
          prev.map((group) => (group.id === groupId ? { ...group, collapsed: false } : group)),
        );
      }

      setTabs((prev) => {
        const next = prev.map((tab) => (tab.id === tabId ? { ...tab, groupId } : tab));
        const targetId =
          targetTabId ||
          [...next].reverse().find((tab) => tab.id !== tabId && tab.groupId === groupId)?.id;

        if (!targetId) return next;

        return moveTabInList(next, tabId, targetId, targetTabId ? 'before' : 'after');
      });
    },
    [activeTabId],
  );

  const removeTabFromGroup = React.useCallback((tabId: string, targetTabId?: string) => {
    setTabs((prev) => {
      const sourceTab = prev.find((tab) => tab.id === tabId);
      const sourceGroupId = sourceTab?.groupId;

      if (!sourceGroupId) return prev;

      const next = prev.map((tab) => (tab.id === tabId ? { ...tab, groupId: undefined } : tab));

      if (targetTabId) return moveTabInList(next, tabId, targetTabId);

      const lastGroupTab = [...next].reverse().find((tab) => tab.groupId === sourceGroupId);

      if (!lastGroupTab) return next;

      return moveTabInList(next, tabId, lastGroupTab.id, 'after');
    });
  }, []);

  const updateTabGroup = React.useCallback(
    (groupId: string, data: Partial<Pick<IAppTabGroup, 'title' | 'color' | 'collapsed'>>) => {
      const nextGroups = tabGroups.map((group) =>
        group.id === groupId ? { ...group, ...data } : group,
      );

      if (data.collapsed && activeTabId) {
        const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId);
        const activeTab = tabs[activeIndex];

        if (activeTab?.groupId === groupId) {
          const isVisible = (tab: IAppTab) => {
            const group = nextGroups.find((item) => item.id === tab.groupId);

            return !group?.collapsed;
          };

          let nextActiveTabId: string | undefined;

          for (let i = activeIndex - 1; i >= 0; i--) {
            if (isVisible(tabs[i])) {
              nextActiveTabId = tabs[i].id;
              break;
            }
          }

          if (!nextActiveTabId) {
            for (let i = activeIndex + 1; i < tabs.length; i++) {
              if (isVisible(tabs[i])) {
                nextActiveTabId = tabs[i].id;
                break;
              }
            }
          }

          if (nextActiveTabId) {
            setActiveTabId(nextActiveTabId);
          } else {
            setActiveTabId(undefined);
          }
        }
      }

      setTabGroups(nextGroups);
    },
    [activeTabId, tabGroups, tabs],
  );

  const ungroupTabGroup = React.useCallback((groupId: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.groupId === groupId ? { ...tab, groupId: undefined } : tab)),
    );
    setTabGroups((prev) => prev.filter((group) => group.id !== groupId));
  }, []);

  const closeTabGroup = React.useCallback(
    (groupId: string) => {
      const tabIds = tabs.filter((tab) => tab.groupId === groupId).map((tab) => tab.id);

      removeTab(tabIds);
    },
    [removeTab, tabs],
  );

  const getTab = (tabId: string) => {
    return tabs.find((tab) => tab.id === tabId);
  };

  const updateTab = React.useCallback(
    (id: string, data: Partial<Pick<IAppTab, 'title' | 'subtitle' | 'unsaved'>>) => {
      setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
    },
    [],
  );

  const hasRestoredTabs = useRestoreTabsFromStorage(setActiveTabId, setTabs, setTabGroups);

  useSaveTabsOnStorage(activeTabId, tabs, tabGroups, hasRestoredTabs);

  React.useEffect(() => {
    setTabGroups((prev) => cleanupEmptyGroups(prev, tabs));
  }, [tabs]);

  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.key?.toLowerCase?.() === 'w' && activeTabId) {
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
        tabGroups,
        addTab,
        removeTab,
        moveTab,
        createTabGroup,
        addTabToGroup,
        removeTabFromGroup,
        updateTabGroup,
        ungroupTabGroup,
        closeTabGroup,
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
