import React from 'react';
import { Modal } from '@renderer/components/Modal';
import { useThemeContext } from '@renderer/contexts/Theme';
import { classes } from '@renderer/styles/theme';
import { SettingsCustomizationPanel } from './components/SettingsCustomizationPanel';
import { SettingsImportPanel } from './components/SettingsImportPanel';
import styles from './styles.module.css';

type SettingsMenu = 'import' | 'customization';

const menuItems: { id: SettingsMenu; label: string; description: string }[] = [
  {
    id: 'import',
    label: 'Importação',
    description: 'Origens externas',
  },
  {
    id: 'customization',
    label: 'Personalização',
    description: 'Temas e cores',
  },
];

export const SettingsModal = React.memo(({ show, onClose }: ISettingsModalProps) => {
  const {
    activeTheme: { modal: colors, __colors },
  } = useThemeContext();

  const [activeMenu, setActiveMenu] = React.useState<SettingsMenu>('import');

  return (
    <Modal
      title="Configurações"
      width="920px"
      height="78vh"
      show={show}
      closeOutside
      onClose={onClose}
    >
      <div className={styles.layout}>
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
