import { serializeInitialWhere } from '@renderer/database/tableFilters';
import { useEffect } from 'react';
import { writeStorageValue } from '@renderer/utils/storage';
import {
  APP_TABS_SESSION_STORAGE_KEY,
  type IAppTab,
  type IAppTabGroup,
  type IAppTabsSession,
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

      serializableTabs.push({ id, groupId, title, subtitle, unsaved, data: data.type === 'table-info'
        ? { ...data, initialWhere: serializeInitialWhere(data.initialWhere) } : data });
    }

    const nextActiveTabId = serializableTabs.some((tab) => tab.id === activeTabId)
      ? activeTabId
      : serializableTabs[0]?.id;
    const serializableTabGroups = tabGroups.filter((group) =>
      serializableTabs.some((tab) => tab.groupId === group.id),
    );

    // Shared restore snapshot only: open windows never replace their live tabs from storage.
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
