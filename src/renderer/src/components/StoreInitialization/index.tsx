import React from 'react';
import { useThemeStore } from '@renderer/stores/Theme';
import { applyMonacoTheme } from '@renderer/styles/theme';
import { useI18nStore } from '@renderer/stores/I18n';
import { useToastStore } from '@renderer/stores/Toast';
import { initializeStores } from '@renderer/stores/initialize';
import { getErrorMessage } from '@shared/utils/error';

interface Props {
  onInitialized?: () => void;
}

export const StoreInitialization = ({ onInitialized }: Props) => {
  const activeTheme = useThemeStore((state) => state.activeTheme);

  const showToast = useToastStore((state) => state.showToast);

  React.useEffect(() => {
    applyMonacoTheme(activeTheme);
  }, [activeTheme]);

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
