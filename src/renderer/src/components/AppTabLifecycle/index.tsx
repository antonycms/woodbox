import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useAppTabStore } from '@renderer/stores/AppTab';
import { useI18nStore } from '@renderer/stores/I18n';
import { isPrimaryShortcutPressed } from '@renderer/utils/keyboard';
import ModalConfirmDiscardChanges from '@renderer/components/ModalConfirmDiscardChanges';
import { useRestoreTabsFromStorage } from './hooks/useRestoreTabsFromStorage';
import { useSaveTabsOnStorage } from './hooks/useSaveTabsOnStorage';

export const AppTabLifecycle = () => {
  const {
    tabs,
    tabGroups,
    activeTabId,
    pendingRemoveTabs,
    removeTab,
    reopenClosedTab,
    cancelPendingRemoveTabs,
    confirmPendingRemoveTabs,
  } = useAppTabStore(
    useShallow((state) => ({
      tabs: state.tabs,
      tabGroups: state.tabGroups,
      activeTabId: state.activeTabId,
      pendingRemoveTabs: state.pendingRemoveTabs,
      removeTab: state.removeTab,
      reopenClosedTab: state.reopenClosedTab,
      cancelPendingRemoveTabs: state.cancelPendingRemoveTabs,
      confirmPendingRemoveTabs: state.confirmPendingRemoveTabs,
    })),
  );
  const t = useI18nStore((state) => state.t);
  const hasRestoredTabs = useRestoreTabsFromStorage();
  useSaveTabsOnStorage(activeTabId, tabs, tabGroups, hasRestoredTabs);

  React.useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (isPrimaryShortcutPressed(event) && event.key?.toLowerCase() === 'w' && activeTabId) {
        event.preventDefault();
        removeTab(activeTabId);
      }
      if (isPrimaryShortcutPressed(event) && event.shiftKey && event.key?.toLowerCase() === 't') {
        event.preventDefault();
        reopenClosedTab();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [activeTabId, removeTab, reopenClosedTab]);

  return (
    <ModalConfirmDiscardChanges
      show={!!pendingRemoveTabs}
      message={t('message.closeUnsavedTab')}
      onCancel={cancelPendingRemoveTabs}
      onConfirm={confirmPendingRemoveTabs}
    />
  );
};
