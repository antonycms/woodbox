import { en, type TranslationKey } from './languages/en';
import { ptBR } from './languages/ptBR';

export type { TranslationKey } from './languages/en';

export const supportedLanguageCodes = ['en', 'pt-BR'] as const;
export type LanguageCode = (typeof supportedLanguageCodes)[number];

export const DEFAULT_LANGUAGE: LanguageCode = 'en';

export const availableLanguages: {
  code: LanguageCode;
  labelKey: TranslationKey;
  systemCodes: string[];
}[] = [
  { code: 'en', labelKey: 'settings.language.option.en', systemCodes: ['en'] },
  { code: 'pt-BR', labelKey: 'settings.language.option.ptBR', systemCodes: ['pt', 'pt-BR'] },
];

export const translations: Record<LanguageCode, Record<TranslationKey, string>> = {
  en,
  'pt-BR': ptBR,
};
