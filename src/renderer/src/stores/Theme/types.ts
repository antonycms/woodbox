import type { ITheme } from '@renderer/styles/theme';

export interface IThemeStore {
  activeTheme: ITheme;
  availableThemes: ITheme[];
  addTheme(theme: ITheme, options?: IAddThemeOptions): void;
  removeTheme(themeName: string, fallbackThemeName?: string): void;
  changeTheme(themeName: string): void;
}

export interface IAddThemeOptions {
  activate?: boolean;
}
