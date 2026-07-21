import React from 'react';
import useStorage from '@renderer/hooks/useStorage';
import I18nContext, { type II18nContext, type TranslationValues } from './context';
import {
  availableLanguages,
  DEFAULT_LANGUAGE,
  supportedLanguageCodes,
  translations,
  type LanguageCode,
  type TranslationKey,
} from './translations';

export type * from './context';
export type { LanguageCode, TranslationKey } from './translations';

const isLanguageCode = (value: unknown): value is LanguageCode => {
  return supportedLanguageCodes.includes(value as LanguageCode);
};

const getInitialLanguage = (): LanguageCode => {
  const systemLanguages = navigator.languages?.length ? navigator.languages : [navigator.language];

  for (const systemLanguage of systemLanguages) {
    const normalizedLanguage = systemLanguage.toLowerCase();
    const availableLanguage = availableLanguages.find((language) =>
      language.systemCodes.some((code) => normalizedLanguage === code.toLowerCase()),
    );

    if (availableLanguage) return availableLanguage.code;

    const availableBaseLanguage = availableLanguages.find((language) =>
      language.systemCodes.some((code) => normalizedLanguage.startsWith(`${code.toLowerCase()}-`)),
    );

    if (availableBaseLanguage) return availableBaseLanguage.code;
  }

  return DEFAULT_LANGUAGE;
};

const formatMessage = (message: string, values?: TranslationValues) => {
  if (!values) return message;

  return message.replace(/\{\{(\w+)}}/g, (_, key: string) => String(values[key] ?? ''));
};

const normalizeTranslationText = (text: string) => text.trim().replace(/\s+/g, ' ');

const translationKeyByText = new Map<string, TranslationKey>();

for (const messages of Object.values(translations)) {
  for (const key in messages) {
    translationKeyByText.set(messages[key], key as TranslationKey);
    translationKeyByText.set(normalizeTranslationText(messages[key]), key as TranslationKey);
  }
}

const I18nProvider = ({ children }: { children: React.ReactNode }) => {
  const [storedLanguage, setStoredLanguage] = useStorage<LanguageCode>(
    '@language:active',
    getInitialLanguage(),
  );

  const language = isLanguageCode(storedLanguage) ? storedLanguage : DEFAULT_LANGUAGE;

  const changeLanguage = React.useCallback(
    (nextLanguage: LanguageCode) => {
      setStoredLanguage(nextLanguage);
    },
    [setStoredLanguage],
  );

  const t = React.useCallback(
    (key: TranslationKey, values?: TranslationValues) => {
      const message = translations[language][key] || translations[DEFAULT_LANGUAGE][key] || key;

      return formatMessage(message, values);
    },
    [language],
  );

  const tText = React.useCallback(
    (text?: string) => {
      if (!text) return text;

      const key =
        translationKeyByText.get(text) || translationKeyByText.get(normalizeTranslationText(text));

      return key ? t(key) : text;
    },
    [t],
  );

  const value = React.useMemo<II18nContext>(
    () => ({ language, availableLanguages, changeLanguage, t, tText }),
    [changeLanguage, language, t, tText],
  );

  React.useEffect(() => {
    if (storedLanguage !== language) {
      setStoredLanguage(language);
    }
  }, [language, setStoredLanguage, storedLanguage]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
};

export const useI18n = () => {
  return React.useContext(I18nContext);
};

export default I18nProvider;
