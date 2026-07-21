import React from 'react';
import {
  availableLanguages,
  DEFAULT_LANGUAGE,
  type LanguageCode,
  type TranslationKey,
} from './translations';

export type TranslationValues = Record<string, string | number>;
export type TranslateFn = (key: TranslationKey, values?: TranslationValues) => string;
export type TranslateTextFn = (text?: string) => string | undefined;

export interface II18nContext {
  language: LanguageCode;
  availableLanguages: typeof availableLanguages;
  changeLanguage(language: LanguageCode): void;
  t: TranslateFn;
  tText: TranslateTextFn;
}

const I18nContext = React.createContext<II18nContext>({
  language: DEFAULT_LANGUAGE,
  availableLanguages,
  changeLanguage: () => {},
  t: (key) => key,
  tText: (text) => text,
});

export default I18nContext;
