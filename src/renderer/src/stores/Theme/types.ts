import type { ITheme } from '@renderer/styles/theme';

export interface IThemeStore {
  activeTheme: ITheme;
  availableThemes: ITheme[];
  addTheme(theme: ITheme, options?: IAddThemeOptions): void;
  removeTheme(themeName: string, fallbackThemeName?: string): void;
  changeTheme(themeName: string): void;
  createThemeFromColors(themeName: string, colors: Record<string, string>, baseThemeName?: string): void;
  updateActiveThemeColors(colors: Record<string, string>): void;
}

export interface IAddThemeOptions {
  activate?: boolean;
}
