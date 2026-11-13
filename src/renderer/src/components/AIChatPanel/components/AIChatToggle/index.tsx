import React from 'react';
import { useAIChatPanelStore } from '@renderer/stores/AIChatPanel';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { IconAI } from '@renderer/styles/icons';
import styles from '../../styles.module.css';

export const AIChatToggle = () => {
  const toggleChatPanel = useAIChatPanelStore((state) => state.toggleChatPanel);
  const t = useI18nStore((state) => state.t);
  const theme = useThemeStore((state) => state.activeTheme.mainTab);

  return (
    <button
      className={styles.toggleButton}
      type="button"
      title={t('aiChat.togglePanel')}
      aria-label={t('aiChat.togglePanel')}
      style={
        {
          '--borderColor': theme.bar.borderColor,
          '--backgroundColor': theme.backgroundColor,
          '--color': theme.color,
          '--ascentColor': theme.ascentColor,
        } as React.CSSProperties
      }
      onClick={toggleChatPanel}
    >
      <IconAI size={18} />
    </button>
  );
};
