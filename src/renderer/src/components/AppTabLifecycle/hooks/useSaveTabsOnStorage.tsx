import { useEffect } from 'react';
import { writeStorageValue } from '@renderer/utils/storage';
import {
  APP_TABS_SESSION_STORAGE_KEY,
  IAppTab,
  IAppTabGroup,
  IAppTabsSession,
} from '@renderer/stores/AppTab/types';

export const useSaveTabsOnStorage = (
  activeTabId: string | undefined,
  tabs: IAppTab[],
  tabGroups: IAppTabGroup[],
  hasRestoredTabs?: boolean,
) => {
  useEffect(() => {
    if (!hasRestoredTabs) return;

    const serializableTabs: IAppTabsSession['tabs'] = [];

    for (const tab of tabs) {
      if (!tab.data) continue;

      const { id, groupId, title, subtitle, unsaved, data } = tab;

      serializableTabs.push({ id, groupId, title, subtitle, unsaved, data });
    }

    const nextActiveTabId = serializableTabs.some((tab) => tab.id === activeTabId)
      ? activeTabId
      : serializableTabs[0]?.id;
    const serializableTabGroups = tabGroups.filter((group) =>
      serializableTabs.some((tab) => tab.groupId === group.id),
    );

    writeStorageValue(
      APP_TABS_SESSION_STORAGE_KEY,
      {
        tabs: serializableTabs,
        tabGroups: serializableTabGroups,
        activeTabId: nextActiveTabId,
      },
    );
  }, [tabs, tabGroups, activeTabId, hasRestoredTabs]);
};
