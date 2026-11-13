import React from 'react';
import SpinnerLoading from '@renderer/components/Loaders/SpinnerLoading';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import styles from './styles.module.css';

export const LoadingPlaceholder = () => {
  const t = useI18nStore((state) => state.t);
  const color = useThemeStore((state) => state.activeTheme.mainTab.ascentColor);
  const [visible, setVisible] = React.useState(false);

  React.useEffect(() => {
    const timer = window.setTimeout(() => setVisible(true), 150);
    return () => window.clearTimeout(timer);
  }, []);

  return (
    <div className={styles.container} role="status" aria-label={t('common.loading')} aria-busy="true">
      {visible && (
        <div className={styles.content} aria-hidden="true">
          <SpinnerLoading size={22} thickness={2} color={color} background="transparent" />
        </div>
      )}
    </div>
  );
};
