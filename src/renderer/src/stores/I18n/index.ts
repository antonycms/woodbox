import { create } from 'zustand';
import { readStorageValue, writeStorageValue } from '@renderer/utils/storage';
import type { II18nStore, TranslationValues } from './types';
import {
  availableLanguages,
  DEFAULT_LANGUAGE,
  supportedLanguageCodes,
  translations,
  type LanguageCode,
  type TranslationKey,
} from './translations';

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
      language.systemCodes.some((code) => normalizedLanguage.startsWith(code.toLowerCase() + '-')),
    );

    if (availableBaseLanguage) return availableBaseLanguage.code;
  }

  return DEFAULT_LANGUAGE;
};

const getStoredLanguage = () => {
  const stored = readStorageValue<unknown>('@language:active', getInitialLanguage());

  return isLanguageCode(stored) ? stored : DEFAULT_LANGUAGE;
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

const createTranslators = (language: LanguageCode) => {
  const t: II18nStore['t'] = (key, values) => {
    const message = translations[language][key] || translations[DEFAULT_LANGUAGE][key] || key;
    return formatMessage(message, values);
  };
  const tText: II18nStore['tText'] = (text) => {
    if (!text) return text;
    const key =
      translationKeyByText.get(text) || translationKeyByText.get(normalizeTranslationText(text));
    return key ? t(key) : text;
  };
  return { t, tText };
};

export const useI18nStore = create<II18nStore>()((set, get) => {
  const writeLocalLanguage = (language: LanguageCode) => {
    writeStorageValue('@language:active', language);
  };

  const persistLanguage = (language: LanguageCode) => {
    writeStorageValue('@language:active', language);
    void window.api.preferences.set({ language }).catch(console.error);
  };

  const language = getStoredLanguage();

  return {
    language,
    availableLanguages,
    ...createTranslators(language),
    hydrate: async () => {
      const preferences = await window.api.preferences.get();
      const storedLanguage = isLanguageCode(preferences.language) ? preferences.language : undefined;
      const language = storedLanguage ?? get().language;

      set({ language, ...createTranslators(language) });
      if (storedLanguage) {
        writeLocalLanguage(language);
      } else {
        persistLanguage(language);
      }
    },
    changeLanguage: (nextLanguage) => {
      const language = isLanguageCode(nextLanguage) ? nextLanguage : DEFAULT_LANGUAGE;
      set({ language, ...createTranslators(language) });
      persistLanguage(language);
    },
  };
});
