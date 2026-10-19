import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useThemeStore } from '@renderer/stores/Theme';
import { useI18nStore } from '@renderer/stores/I18n';
import { getThemeLabel } from '@renderer/utils/theme';
import styles from './styles.module.css';

export const ThemePreviews = ({ onSelect }: { onSelect: (name: string) => void }) => {
  const { availableThemes, activeTheme } = useThemeStore(
    useShallow((state) => ({ availableThemes: state.availableThemes, activeTheme: state.activeTheme })),
  );
  const { t, tText } = useI18nStore(useShallow((state) => ({ t: state.t, tText: state.tText })));

  return (
    <div className={styles.themes} role="group" aria-label={t('settings.customization.activeTheme')}>
      {availableThemes.map((theme) => {
        const selected = theme.name === activeTheme.name;
        const label = getThemeLabel(theme, t, tText);

        return (
          <button
            key={theme.name}
            type="button"
            className={styles.theme}
            aria-pressed={selected}
            title={label}
            onClick={() => onSelect(theme.name)}
            style={{ color: selected ? activeTheme.modal.saveButtonBackgroundColor : activeTheme.settings.mutedColor }}
          >
            <span
              className={styles.preview}
              aria-hidden="true"
              style={{
                backgroundColor: theme.modal.backgroundColor,
                borderColor: selected ? activeTheme.modal.saveButtonBackgroundColor : activeTheme.settings.themeBorderColor,
              }}
            >
              <span className={styles.sidebar} style={{ backgroundColor: theme.modal.fieldBackgroundColor }}>
                <i style={{ backgroundColor: theme.modal.saveButtonBackgroundColor }} />
                <i style={{ backgroundColor: theme.modal.fieldColor }} />
                <i style={{ backgroundColor: theme.modal.fieldColor }} />
              </span>
              <span className={styles.content}>
                <i style={{ backgroundColor: theme.modal.saveButtonBackgroundColor }} />
                <i style={{ backgroundColor: theme.modal.fieldColor }} />
                <span style={{ backgroundColor: theme.modal.fieldBackgroundColor }} />
                <span style={{ backgroundColor: theme.modal.fieldBackgroundColor }} />
              </span>
            </span>
            <span className={styles.label}>{label}</span>
          </button>
        );
      })}
    </div>
  );
};
