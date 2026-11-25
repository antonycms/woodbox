import type { ITheme } from '@shared/types/theme';

export interface IThemeStore {
  activeTheme: ITheme;
  availableThemes: ITheme[];
  syncFromStorage(): void;
  addTheme(theme: ITheme, options?: IAddThemeOptions): void;
  removeTheme(themeName: string, fallbackThemeName?: string): void;
  changeTheme(themeName: string): void;
  createThemeFromColors(themeName: string, colors: Record<string, string>, baseThemeName?: string): void;
  updateActiveThemeColors(colors: Record<string, string>): boolean;
}

export interface IAddThemeOptions {
  activate?: boolean;
}
