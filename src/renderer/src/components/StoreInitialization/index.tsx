import React from 'react';
import { useThemeStore } from '@renderer/stores/Theme';
import { applyMonacoTheme } from '@renderer/styles/theme';
import { useI18nStore } from '@renderer/stores/I18n';
import { useToastStore } from '@renderer/stores/Toast';
import { initializeStores } from '@renderer/stores/initialize';
import { getErrorMessage } from '@shared/utils/error';

export const StoreInitialization = () => {
  const activeTheme = useThemeStore((state) => state.activeTheme);

  const t = useI18nStore((state) => state.t);
  const showToast = useToastStore((state) => state.showToast);

  React.useEffect(() => {
    applyMonacoTheme(activeTheme);
  }, [activeTheme]);

  React.useEffect(() => {
    let active = true;
    initializeStores().catch((error) => {
      if (active) {
        showToast({
          type: 'error',
          title: t('toast.initializeStoresError'),
          description: getErrorMessage(error),
        });
      }
    });
    return () => { active = false; };
  }, [showToast, t]);

  return null;
};
