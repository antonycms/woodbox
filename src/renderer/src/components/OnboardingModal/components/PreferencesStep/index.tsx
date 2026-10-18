import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { Autocomplete } from '@renderer/components/Autocomplete';
import { Row } from '@renderer/components/Grid';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import { getThemeLabel } from '@renderer/utils/theme';
import { OnboardingFooter } from '../OnboardingFooter';

interface Props {
  onSkip: () => void;
  onContinue: () => void;
}

export const PreferencesStep = ({ onSkip, onContinue }: Props) => {
  const { language, availableLanguages, changeLanguage, t, tText } = useI18nStore(
    useShallow((state) => ({
      language: state.language,
      availableLanguages: state.availableLanguages,
      changeLanguage: state.changeLanguage,
      t: state.t,
      tText: state.tText,
    })),
  );
  const { activeTheme, availableThemes, changeTheme } = useThemeStore(
    useShallow((state) => ({
      activeTheme: state.activeTheme,
      availableThemes: state.availableThemes,
      changeTheme: state.changeTheme,
    })),
  );
  const colors = activeTheme.modal;

  return (
    <>
      <Row>
        <Autocomplete
          xs={12}
          sm={6}
          required
          clearable={false}
          label={t('settings.language.activeLanguage')}
          data={availableLanguages}
          value={language}
          extractLabel={(item) => t(item.labelKey)}
          extractValue={(item) => item.code}
          onChange={({ value }) => {
            const selected = availableLanguages.find((item) => item.code === value);
            if (selected) changeLanguage(selected.code);
          }}
          color={colors.fieldColor}
          backgroundColor={colors.fieldBackgroundColor}
        />
        <Autocomplete
          xs={12}
          sm={6}
          required
          clearable={false}
          label={t('settings.customization.activeTheme')}
          data={availableThemes}
          value={activeTheme.name}
          extractLabel={(theme) => getThemeLabel(theme, t, tText)}
          extractValue={(theme) => theme.name}
          onChange={({ value }) => {
            if (typeof value === 'string') changeTheme(value);
          }}
          color={colors.fieldColor}
          backgroundColor={colors.fieldBackgroundColor}
        />
      </Row>
      <OnboardingFooter onSkip={onSkip} onContinue={onContinue} />
    </>
  );
};
