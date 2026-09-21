import { create } from 'zustand';
import React from 'react';
import { useI18nStore } from '@renderer/stores/I18n';
import { generateHash } from '@shared/utils/string';
import {
  type IAppTab,
  type IAppTabGroup,
  type IAppTabMovePlacement,
  type IRemoveAppTabOptions,
  type INewAppTab,
  type IAppTabStore,
} from './types';
import { useThemeStore } from '@renderer/stores/Theme';

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

  const remainingGroups = groups.filter((group) => groupIdsWithTabs.has(group.id));
  return remainingGroups.length === groups.length ? groups : remainingGroups;
};

export const useAppTabStore = create<IAppTabStore>()((set, get) => {
  let closedTabs = [] as IAppTab[];
  const setTabs = (
    value: IAppTab[] | ((previous: IAppTab[]) => IAppTab[]),
    tabGroups = get().tabGroups,
  ) => {
    const tabs = typeof value === 'function' ? value(get().tabs) : value;
    set({ tabs, tabGroups: cleanupEmptyGroups(tabGroups, tabs) });
  };

  const restoreSession: IAppTabStore['restoreSession'] = ({
    tabs,
    tabGroups = [],
    activeTabId,
  }) => {
    const storedGroupsById = new Map(tabGroups.map((group) => [group.id, group]));
    const groupIds = [...new Set(tabs.map((tab) => tab.groupId).filter(Boolean))];
    const t = useI18nStore.getState().t;
    const theme = useThemeStore.getState().activeTheme.mainTab;
    const restoredGroups = groupIds.map(
      (id) =>
        storedGroupsById.get(id) || {
          id,
          title: t('tabs.group'),
          color: theme.groupColors[0],
        },
    );
    const visibleTabs = tabs.filter(
      (tab) => !restoredGroups.find((group) => group.id === tab.groupId)?.collapsed,
    );
    closedTabs = [];
    set({
      tabs,
      tabGroups: restoredGroups,
      activeTabId: visibleTabs.some((tab) => tab.id === activeTabId)
        ? activeTabId
        : visibleTabs[0]?.id,
      pendingRemoveTabs: undefined,
    });
  };

  const setActiveTabId = (
    value: string | undefined | ((previous: string | undefined) => string | undefined),
  ) => {
    const next = typeof value === 'function' ? value(get().activeTabId) : value;
    set({ activeTabId: next });
  };

  const addTab = (tabData: INewAppTab) => {
    const { activeTabId } = get();
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
      component: React.memo(component),
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

    setTimeout(() => {
      if (get().tabs.some((item) => item.id === tab.id)) setActiveTabId(tab.id);
    });
  };

  const removeTabWithoutConfirmation = (
    tabId: string | string[],
    options?: IRemoveAppTabOptions,
  ) => {
    const { tabs, tabGroups, activeTabId } = get();
    const tabsIdToRemove = new Set(Array.isArray(tabId) ? tabId : [tabId]);
    const remainingTabs = tabs.filter((t) => !tabsIdToRemove.has(t.id));
    let nextGroups = tabGroups;
    let nextActiveTabId = activeTabId;
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
          nextGroups = nextGroups.map((group) =>
            group.id === remainingTabs[0].groupId ? { ...group, collapsed: false } : group,
          );
        }
      }

      nextActiveTabId = nextId;
    }

    if (options?.keepHistory !== false) {
      closedTabs = [...closedTabs, ...tabs.filter((t) => tabsIdToRemove.has(t.id))];
    }
    set({
      tabs: remainingTabs,
      tabGroups: cleanupEmptyGroups(nextGroups, remainingTabs),
      activeTabId: nextActiveTabId,
    });
  };

  const removeTab = (tabId: string | string[], options?: IRemoveAppTabOptions) => {
    const { tabs } = get();
    const tabsIdToRemove = new Set(Array.isArray(tabId) ? tabId : [tabId]);
    const hasUnsavedTab = tabs.some((tab) => tabsIdToRemove.has(tab.id) && tab.unsaved);

    if (!options?.force && hasUnsavedTab) {
      set({ pendingRemoveTabs: { tabId, options } });
      return;
    }

    removeTabWithoutConfirmation(tabId, options);
  };

  const reopenClosedTab = () => {
    const { tabs, tabGroups, activeTabId } = get();
    const openTabIds = new Set(tabs.map((tab) => tab.id));
    const groupIds = new Set(tabGroups.map((group) => group.id));
    const closedTabIndex = [...closedTabs].reverse().findIndex((tab) => !openTabIds.has(tab.id));

    if (closedTabIndex < 0) return;

    const tabIndex = closedTabs.length - 1 - closedTabIndex;
    const tabToReopen = closedTabs[tabIndex];
    const nextTab = groupIds.has(tabToReopen.groupId || '')
      ? tabToReopen
      : { ...tabToReopen, groupId: undefined };

    closedTabs = closedTabs.filter((_, index) => index !== tabIndex);
    const nextGroups = nextTab.groupId
      ? tabGroups.map((group) =>
          group.id === nextTab.groupId ? { ...group, collapsed: false } : group,
        )
      : tabGroups;
    setTabs((currentTabs) => {
      if (currentTabs.some((tab) => tab.id === nextTab.id)) return currentTabs;

      const activeIndex = currentTabs.findIndex((tab) => tab.id === activeTabId);
      const nextTabs = [...currentTabs];

      if (activeIndex < 0) nextTabs.push(nextTab);
      else nextTabs.splice(activeIndex + 1, 0, nextTab);

      return nextTabs;
    }, nextGroups);
    setActiveTabId(nextTab.id);
  };

  const moveTab = (fromId: string, toId: string, placement: IAppTabMovePlacement = 'before') => {
    setTabs((prev) => moveTabInList(prev, fromId, toId, placement));
  };

  const createTabGroup = (tabId: string) => {
    const { tabs, tabGroups } = get();
    if (!tabs.some((tab) => tab.id === tabId)) return;
    const theme = useThemeStore.getState().activeTheme.mainTab;
    const t = useI18nStore.getState().t;
    const tabGroupColors = [
      theme.groupColors[0],
      theme.groupColors[1],
      theme.groupColors[2],
      theme.groupColors[3],
      theme.groupColors[4],
      theme.groupColors[5],
      theme.groupColors[6],
      theme.groupColors[7],
    ];
    const group: IAppTabGroup = {
      id: generateHash(),
      title: t('tabs.group'),
      color: tabGroupColors[tabGroups.length % tabGroupColors.length],
    };

    setTabs(
      (prev) => prev.map((tab) => (tab.id === tabId ? { ...tab, groupId: group.id } : tab)),
      [...tabGroups, group],
    );

    return group.id;
  };

  const addTabToGroup = (tabId: string, groupId: string, targetTabId?: string) => {
    const { activeTabId, tabGroups } = get();
    if (!tabGroups.some((group) => group.id === groupId)) return;
    const nextGroups =
      tabId === activeTabId
        ? tabGroups.map((group) => (group.id === groupId ? { ...group, collapsed: false } : group))
        : tabGroups;

    setTabs((prev) => {
      const next = prev.map((tab) => (tab.id === tabId ? { ...tab, groupId } : tab));
      const targetId =
        targetTabId ||
        [...next].reverse().find((tab) => tab.id !== tabId && tab.groupId === groupId)?.id;

      if (!targetId) return next;

      return moveTabInList(next, tabId, targetId, targetTabId ? 'before' : 'after');
    }, nextGroups);
  };

  const removeTabFromGroup = (tabId: string, targetTabId?: string) => {
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
  };

  const updateTabGroup = (
    groupId: string,
    data: Partial<Pick<IAppTabGroup, 'title' | 'color' | 'collapsed'>>,
  ) => {
    const { tabGroups, activeTabId, tabs } = get();
    const nextGroups = tabGroups.map((group) =>
      group.id === groupId ? { ...group, ...data } : group,
    );

    let nextActiveTabId = activeTabId;
    if (data.collapsed && activeTabId) {
      const activeIndex = tabs.findIndex((tab) => tab.id === activeTabId);
      const activeTab = tabs[activeIndex];

      if (activeTab?.groupId === groupId) {
        const isVisible = (tab: IAppTab) => {
          const group = nextGroups.find((item) => item.id === tab.groupId);

          return !group?.collapsed;
        };

        nextActiveTabId = undefined;

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
      }
    }

    set({ tabGroups: nextGroups, activeTabId: nextActiveTabId });
  };

  const ungroupTabGroup = (groupId: string) => {
    setTabs((prev) =>
      prev.map((tab) => (tab.groupId === groupId ? { ...tab, groupId: undefined } : tab)),
    );
  };

  const closeTabGroup = (groupId: string) => {
    const { tabs } = get();
    const tabIds = tabs.filter((tab) => tab.groupId === groupId).map((tab) => tab.id);

    removeTab(tabIds);
  };

  const getTab = (tabId: string) => get().tabs.find((tab) => tab.id === tabId);

  const updateTab = (
    id: string,
    data: Partial<Pick<IAppTab, 'title' | 'subtitle' | 'unsaved'>>,
  ) => {
    setTabs((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));
  };

  const cancelPendingRemoveTabs = () => {
    set({ pendingRemoveTabs: undefined });
  };

  const confirmPendingRemoveTabs = () => {
    const { pendingRemoveTabs } = get();
    if (!pendingRemoveTabs) return;

    removeTabWithoutConfirmation(pendingRemoveTabs.tabId, pendingRemoveTabs.options);
    set({ pendingRemoveTabs: undefined });
  };

  return {
    tabs: [],
    tabGroups: [],
    activeTabId: undefined,
    pendingRemoveTabs: undefined,
    addTab,
    removeTab,
    reopenClosedTab,
    moveTab,
    createTabGroup,
    addTabToGroup,
    removeTabFromGroup,
    updateTabGroup,
    ungroupTabGroup,
    closeTabGroup,
    getTab,
    updateTab,
    cancelPendingRemoveTabs,
    confirmPendingRemoveTabs,
    restoreSession,
    setActiveTabId,
  };
});
