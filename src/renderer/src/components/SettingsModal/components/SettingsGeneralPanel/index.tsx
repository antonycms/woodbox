import React from 'react';
import { Autocomplete } from '@renderer/components/Autocomplete';
import { Divider } from '@renderer/components/Divider';
import { Row } from '@renderer/components/Grid';
import { Text } from '@renderer/components/Text';
import { useI18n, type LanguageCode } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';

export const SettingsGeneralPanel = React.memo(() => {
  const { language, availableLanguages, changeLanguage, t } = useI18n();
  const {
    activeTheme: { modal: colors },
  } = useThemeContext();

  const extractLanguageLabel = React.useCallback(
    (item: (typeof availableLanguages)[number]) => t(item.labelKey),
    [t],
  );

  const extractLanguageValue = React.useCallback(
    (item: (typeof availableLanguages)[number]) => item.code,
    [],
  );

  const handleChangeLanguage = React.useCallback(
    (event: { value: string | number | null }) => {
      changeLanguage(event.value as LanguageCode);
    },
    [changeLanguage],
  );

  return (
    <>
      <Text bold color={colors.color} userSelect={false}>
        {t('settings.general.title')}
      </Text>

      <Divider size={8} />

      <Row>
        <Autocomplete
          required
          clearable={false}
          data={availableLanguages}
          label={t('settings.language.activeLanguage')}
          value={language}
          extractLabel={extractLanguageLabel}
          extractValue={extractLanguageValue}
          color={colors.fieldColor}
          backgroundColor={colors.fieldBackgroundColor}
          xs={12}
          onChange={handleChangeLanguage}
        />
      </Row>
    </>
  );
});

SettingsGeneralPanel.displayName = 'SettingsGeneralPanel';
