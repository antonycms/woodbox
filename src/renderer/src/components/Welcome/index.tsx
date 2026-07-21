import { useThemeContext } from '@renderer/contexts/Theme';
import { useI18n } from '@renderer/contexts/I18n';
import React from 'react';
import WoodboxLogo from '@renderer/assets/icons/woodbox.svg?react';
import { getPrimaryShortcutKeyLabel } from '@renderer/utils/keyboard';
import styles from './styles.module.css';

const shortcutKey = getPrimaryShortcutKeyLabel();

const shortcuts = [
  { labelKey: 'welcome.centralSearch', keys: [shortcutKey, 'K'] },
  { labelKey: 'welcome.filterProjects', keys: [shortcutKey, 'Shift', 'F'] },
  { labelKey: 'welcome.closeActiveTab', keys: [shortcutKey, 'W'] },
  { labelKey: 'welcome.runSql', keys: [shortcutKey, 'Enter'] },
  { labelKey: 'welcome.runSqlNewTab', keys: [shortcutKey, 'Shift', 'Enter'] },
] as const;

export const Welcolme = () => {
  const { t } = useI18n();
  const {
    activeTheme: { welcome: colors },
  } = useThemeContext();

  return (
    <div className={styles.container} style={colors}>
      <div className={styles.content}>
        <div className={styles.brandMark} aria-hidden="true">
          <WoodboxLogo className={styles.brandLogo} />
        </div>

        <div className={styles.shortcuts} aria-label={t('welcome.mainShortcuts')}>
          {shortcuts.map((shortcut) => (
            <div key={shortcut.labelKey} className={styles.shortcut}>
              <span className={styles.shortcutLabel}>{t(shortcut.labelKey)}</span>

              <span className={styles.keys}>
                {shortcut.keys.map((key, index) => (
                  <React.Fragment key={key}>
                    {index > 0 && <span className={styles.plus}>+</span>}
                    <kbd className={styles.key}>{key}</kbd>
                  </React.Fragment>
                ))}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
