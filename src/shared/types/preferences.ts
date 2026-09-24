export interface AppPreferences {
  language?: string;
  themeActiveName?: string;
  customThemes?: unknown[];
}

export type AppPreferencesPatch = Partial<AppPreferences>;
