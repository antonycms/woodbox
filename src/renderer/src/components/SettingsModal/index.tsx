import React from 'react';
import { Modal } from '@renderer/components/Modal';
import { useThemeContext } from '@renderer/contexts/Theme';
import { classes } from '@renderer/styles/theme';
import { SettingsCustomizationPanel } from './components/SettingsCustomizationPanel';
import { SettingsImportPanel } from './components/SettingsImportPanel';
import styles from './styles.module.css';

type SettingsMenu = 'import' | 'customization';

const appVersion = typeof __APP_VERSION__ === 'undefined' ? '0.0.0' : __APP_VERSION__;

const menuItems: { id: SettingsMenu; label: string; description: string }[] = [
  {
    id: 'customization',
    label: 'Personalização',
    description: 'Temas e cores',
  },
  {
    id: 'import',
    label: 'Importação',
    description: 'Origens externas',
  },
];

export const SettingsModal = React.memo(({ show, onClose }: ISettingsModalProps) => {
  const {
    activeTheme: { modal: colors, __colors },
  } = useThemeContext();

  const [activeMenu, setActiveMenu] = React.useState<SettingsMenu>('customization');
  const layoutStyle = React.useMemo(
    () =>
      ({
        '--settings-menu-background-color': __colors.darkLightBar,
        '--settings-menu-hover-background-color': __colors.darkLightDeep,
      } as React.CSSProperties),
    [__colors.darkLightBar, __colors.darkLightDeep],
  );

  return (
    <Modal
      title="Configurações"
      width="920px"
      height="78vh"
      show={show}
      closeOutside
      onClose={onClose}
    >
      <div className={styles.layout} style={layoutStyle}>
        <aside className={styles.menu}>
          {menuItems.map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setActiveMenu(item.id)}
              className={classes(styles.menuButton, activeMenu === item.id && styles.active)}
              style={{
                color: activeMenu === item.id ? colors.saveButtonBackgroundColor : colors.color,
                borderColor:
                  activeMenu === item.id ? colors.saveButtonBackgroundColor : __colors.lightGray,
              }}
            >
              <strong>{item.label}</strong>
              <span style={{ color: __colors.gray }}>{item.description}</span>
            </button>
          ))}

          <div className={styles.version} style={{ color: __colors.gray }}>
            v{appVersion}
          </div>
        </aside>

        <section className={styles.content}>
          {activeMenu === 'import' && <SettingsImportPanel />}
          {activeMenu === 'customization' && <SettingsCustomizationPanel />}
        </section>
      </div>
    </Modal>
  );
});

SettingsModal.displayName = 'SettingsModal';

export interface ISettingsModalProps {
  show?: boolean;
  onClose?: () => void;
}
