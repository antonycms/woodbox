import { availableLanguages, type LanguageCode, type TranslationKey } from './translations';

export type TranslationValues = Record<string, string | number>;
export type TranslateFn = (key: TranslationKey, values?: TranslationValues) => string;
export type TranslateTextFn = (text?: string) => string | undefined;

export interface II18nStore {
  language: LanguageCode;
  availableLanguages: typeof availableLanguages;
  changeLanguage(language: LanguageCode): void;
  t: TranslateFn;
  tText: TranslateTextFn;
}
