import React from 'react';
import { Divider } from '@renderer/components/Divider';
import { Text } from '@renderer/components/Text';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import styles from './styles.module.css';

const appVersion = typeof __APP_VERSION__ === 'undefined' ? '0.0.0' : __APP_VERSION__;
const repositoryUrl = 'https://github.com/antonycms/woodbox';

export const SettingsAboutPanel = React.memo(() => {
  const t = useI18nStore((state) => state.t);
  const { modal: colors, settings } = useThemeStore((state) => state.activeTheme);

  return (
    <div>
      <Text bold color={colors.color} userSelect={false}>
        {t('settings.menu.about.label')}
      </Text>
      <Divider size={8} />
      <Text small color={settings.mutedColor} userSelect={false}>
        {t('settings.about.description')}
      </Text>
      <Divider size={16} />
      <Text small color={settings.mutedColor} userSelect={false}>
        {t('settings.about.version', { version: appVersion })}
      </Text>
      <Divider size={8} />
      <Text small color={settings.mutedColor} userSelect={false}>
        {t('settings.about.license')}
      </Text>
      <Divider size={16} />
      <nav className={styles.links} style={{ color: colors.saveButtonBackgroundColor }}>
        <a href={repositoryUrl} target="_blank" rel="noopener noreferrer">
          {t('settings.about.repository')}
        </a>
        <a href={`${repositoryUrl}/releases`} target="_blank" rel="noopener noreferrer">
          {t('settings.about.releases')}
        </a>
        <a href={`${repositoryUrl}/issues`} target="_blank" rel="noopener noreferrer">
          {t('settings.about.issues')}
        </a>
      </nav>
    </div>
  );
});

SettingsAboutPanel.displayName = 'SettingsAboutPanel';
