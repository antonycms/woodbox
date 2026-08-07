import React from 'react';
import { Modal } from '@renderer/components/Modal';
import { useI18n, type TranslationKey } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { classes } from '@renderer/styles/theme';
import { SettingsCustomizationPanel } from './components/SettingsCustomizationPanel';
import { SettingsGeneralPanel } from './components/SettingsGeneralPanel';
import styles from './styles.module.css';

type SettingsMenu = 'general' | 'customization';

const appVersion = typeof __APP_VERSION__ === 'undefined' ? '0.0.0' : __APP_VERSION__;

const menuItems: { id: SettingsMenu; labelKey: TranslationKey; descriptionKey: TranslationKey }[] =
  [
    {
      id: 'general',
      labelKey: 'settings.menu.general.label',
      descriptionKey: 'settings.menu.general.description',
    },
    {
      id: 'customization',
      labelKey: 'settings.menu.customization.label',
      descriptionKey: 'settings.menu.customization.description',
    },
  ];

export const SettingsModal = React.memo(({ show, onClose }: ISettingsModalProps) => {
  const { t } = useI18n();
  const {
    activeTheme: { modal: colors, __colors },
  } = useThemeContext();

  const [activeMenu, setActiveMenu] = React.useState<SettingsMenu>('general');
  const layoutStyle = React.useMemo(
    () =>
      ({
        '--settings-menu-background-color': __colors.darkLightBar,
        '--settings-menu-hover-background-color': __colors.darkLightDeep,
      }) as React.CSSProperties,
    [__colors.darkLightBar, __colors.darkLightDeep],
  );

  return (
    <Modal
      title={t('settings.title')}
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
              <strong>{t(item.labelKey)}</strong>
              <span style={{ color: __colors.gray }}>{t(item.descriptionKey)}</span>
            </button>
          ))}

          <div className={styles.version} style={{ color: __colors.gray }}>
            v{appVersion}
          </div>
        </aside>

        <section className={styles.content}>
          {activeMenu === 'general' && <SettingsGeneralPanel />}
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
