import { useThemeContext } from '@renderer/contexts/Theme';
import React from 'react';
import WoodboxLogo from '@renderer/assets/icons/woodbox.svg?react';
import { getPrimaryShortcutKeyLabel } from '@renderer/utils/keyboard';
import styles from './styles.module.css';

const shortcutKey = getPrimaryShortcutKeyLabel();

const shortcuts = [
  { label: 'Busca centralizada', keys: [shortcutKey, 'K'] },
  { label: 'Filtrar projetos', keys: [shortcutKey, 'Shift', 'F'] },
  { label: 'Fechar aba ativa', keys: [shortcutKey, 'W'] },
  { label: 'Executar SQL', keys: [shortcutKey, 'Enter'] },
  { label: 'Executar SQL em outra aba', keys: [shortcutKey, 'Shift', 'Enter'] },
];

export const Welcolme = () => {
  const {
    activeTheme: { welcome: colors },
  } = useThemeContext();

  return (
    <div className={styles.container} style={colors}>
      <div className={styles.content}>
        <div className={styles.brandMark} aria-hidden="true">
          <WoodboxLogo className={styles.brandLogo} />
        </div>

        <div className={styles.shortcuts} aria-label="Atalhos principais">
          {shortcuts.map((shortcut) => (
            <div key={shortcut.label} className={styles.shortcut}>
              <span className={styles.shortcutLabel}>{shortcut.label}</span>

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
