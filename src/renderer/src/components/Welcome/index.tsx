import { useThemeContext } from '@renderer/contexts/Theme';
import React from 'react';
import WoodboxLogo from '@renderer/assets/icons/woodbox.svg?react';
import styles from './styles.module.css';

export const Welcolme = () => {
  const {
    activeTheme: { welcome: colors },
  } = useThemeContext();

  const shortcuts = [
    { label: 'Filtrar projetos', keys: ['Ctrl', 'Shift', 'F'] },
    { label: 'Executar SQL', keys: ['Ctrl', 'Enter'] },
    { label: 'Fechar aba ativa', keys: ['Ctrl', 'W'] },
    { label: 'Salvar alterações', keys: ['Ctrl', 'S'] },
  ];

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
