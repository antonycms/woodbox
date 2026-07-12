import type { ITheme } from '@renderer/styles/theme';
import { createContext } from 'react';

export interface IThemeProviderProps {
  children?: React.ReactNode;
}

export interface IThemeContext {
  activeTheme: ITheme<string>;
  availableThemes: ITheme<string>[];
  addTheme(theme: ITheme, options?: IAddThemeOptions): void;
  removeTheme(themeName: string, fallbackThemeName?: string): void;
  changeTheme(themeName: string): void;
}

export interface IAddThemeOptions {
  activate?: boolean;
}

export default createContext<IThemeContext>({} as IThemeContext);
