import React from 'react';
import { Autocomplete } from '@renderer/components/Autocomplete';
import { Divider } from '@renderer/components/Divider';
import { Row } from '@renderer/components/Grid';
import { Text } from '@renderer/components/Text';
import { useI18n, type LanguageCode } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';

export const SettingsLanguagePanel = React.memo(() => {
  const { language, availableLanguages, changeLanguage, t } = useI18n();
  const {
    activeTheme: { modal: colors },
  } = useThemeContext();

  const languageOptions = React.useMemo(() => [...availableLanguages], [availableLanguages]);

  return (
    <>
      <Text bold color={colors.color} userSelect={false}>
        {t('settings.language.title')}
      </Text>

      <Divider size={8} />

      <Row>
        <Autocomplete
          required
          clearable={false}
          data={languageOptions}
          label={t('settings.language.activeLanguage')}
          value={language}
          extractLabel={(item) => t(item.labelKey)}
          extractValue={(item) => item.code}
          color={colors.fieldColor}
          backgroundColor={colors.fieldBackgroundColor}
          xs={12}
          onChange={(event) => changeLanguage(event.value as LanguageCode)}
        />
      </Row>
    </>
  );
});

SettingsLanguagePanel.displayName = 'SettingsLanguagePanel';
