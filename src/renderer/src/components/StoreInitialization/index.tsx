import React from 'react';
import { useThemeStore } from '@renderer/stores/Theme';
import { useI18nStore } from '@renderer/stores/I18n';
import { useToastStore } from '@renderer/stores/Toast';
import { initializeStores } from '@renderer/stores/initialize';
import { getErrorMessage } from '@shared/utils/error';

interface Props {
  onInitialized?: () => void;
}

export const StoreInitialization = ({ onInitialized }: Props) => {
  const showToast = useToastStore((state) => state.showToast);

  React.useEffect(() => {
    const syncPreferences = () => {
      useThemeStore.getState().syncFromStorage();
      useI18nStore.getState().syncFromStorage();
    };
    const onStorage = (event: StorageEvent) => {
      if (event.storageArea !== window.localStorage) return;
      if (event.key === null || event.key === '@theme:available' || event.key === '@theme:active') {
        useThemeStore.getState().syncFromStorage();
      }
      if (event.key === null || event.key === '@language:active') {
        useI18nStore.getState().syncFromStorage();
      }
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener('focus', syncPreferences);
    syncPreferences();
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('focus', syncPreferences);
    };
  }, []);

  React.useEffect(() => {
    let active = true;
    initializeStores()
      .then(() => {
        if (active) onInitialized?.();
      })
      .catch((error) => {
        if (active) {
          const t = useI18nStore.getState().t;
          showToast({
            type: 'error',
            title: t('toast.initializeStoresError'),
            description: getErrorMessage(error, t('common.unknownError')),
          });
        }
      });
    return () => { active = false; };
  }, [showToast, onInitialized]);

  return null;
};
