import type { StoreApi } from 'zustand/vanilla';
import type { ITableInfoStore } from './types';
import { useAppTabStore } from '@renderer/stores/AppTab';

// One unsaved writer for this instance, based on the current drafts.
// Mounted by a passive effect: Suspense/Freeze hiding must not dispose the owner.
export const bindTableInfoTab = (store: StoreApi<ITableInfoStore>, tabId?: string) => {
  let active = true;
  let rowsChanged = false;
  let propertiesChanged = false;
  let tabIndex = useAppTabStore.getState().tabs.findIndex((item) => item.id === tabId);
  const component = useAppTabStore.getState().tabs[tabIndex]?.component;
  let observedUnsaved = useAppTabStore.getState().tabs[tabIndex]?.unsaved;
  let unsubscribeStore = () => {};
  let unsubscribeTabs = () => {};
  const dispose = () => {
    if (!active) return;
    active = false;
    unsubscribeStore(); unsubscribeTabs();
  };
  const ownTab = () => {
    const { tabs } = useAppTabStore.getState();
    if (tabs[tabIndex]?.id !== tabId) tabIndex = tabs.findIndex((item) => item.id === tabId);
    return tabs[tabIndex];
  };
  const syncUnsaved = () => {
    if (!active || !tabId || !component) return;
    const tab = ownTab();
    if (tab?.component !== component) { dispose(); return; }
    const state = store.getState();
    const unsaved = state.tableContext.mode === 'create' || rowsChanged || propertiesChanged ||
      [state.pendingColumns, state.pendingChangedColumns,
        state.pendingDroppedColumns, state.pendingIndexes, state.pendingDroppedIndexes,
        state.pendingRestrictions, state.pendingDroppedRestrictions, state.pendingReferences,
        state.pendingDroppedReferences].some((items) => items.length > 0);
    if (tab.unsaved !== unsaved) useAppTabStore.getState().updateTab(tabId, { unsaved });
  };
  const draftKeys = ['pendingColumns', 'pendingChangedColumns', 'pendingDroppedColumns',
    'pendingIndexes', 'pendingDroppedIndexes', 'pendingRestrictions', 'pendingDroppedRestrictions',
    'pendingReferences', 'pendingDroppedReferences'] as const;
  unsubscribeStore = store.subscribe((state, previous) => {
    if (state.tableContext.mode !== previous.tableContext.mode || draftKeys.some((key) => state[key] !== previous[key])) syncUnsaved();
  });
  unsubscribeTabs = useAppTabStore.subscribe((state, previous) => {
    if (!active || state.tabs === previous.tabs || !tabId || !component) return;
    const tab = ownTab();
    if (tab?.component !== component) dispose();
    else if (tab.unsaved !== observedUnsaved) { observedUnsaved = tab.unsaved; syncUnsaved(); }
  });
  syncUnsaved();
  return {
    dispose,
    setRowsChanged(value: boolean) { if (active) { rowsChanged = value; syncUnsaved(); } },
    setPropertiesChanged(value: boolean) { if (active) { propertiesChanged = value; syncUnsaved(); } },
  };
};
