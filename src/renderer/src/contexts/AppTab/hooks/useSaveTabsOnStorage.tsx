import { useEffect } from 'react';
import { APP_TABS_SESSION_STORAGE_KEY, IAppTab, IAppTabsSession } from '../context';

export const useSaveTabsOnStorage = (
  activeTabId: string,
  tabs: IAppTab[],
  hasRestoredTabs?: boolean,
) => {
  useEffect(() => {
    if (!hasRestoredTabs) return;

    const serializableTabs: IAppTabsSession['tabs'] = [];

    for (const tab of tabs) {
      if (!tab.data) continue;

      const { id, title, subtitle, unsaved, data } = tab;

      serializableTabs.push({ id, title, subtitle, unsaved, data });
    }

    const nextActiveTabId = serializableTabs.some((tab) => tab.id === activeTabId)
      ? activeTabId
      : serializableTabs[0]?.id;

    window.localStorage.setItem(
      APP_TABS_SESSION_STORAGE_KEY,
      JSON.stringify({ tabs: serializableTabs, activeTabId: nextActiveTabId }),
    );
  }, [tabs, activeTabId]);
};
