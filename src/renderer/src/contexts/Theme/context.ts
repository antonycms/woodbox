import type { ITheme } from '@renderer/styles/theme';
import { createContext } from 'react';

export interface IThemeProviderProps {
  children?: React.ReactNode;
}

export interface IThemeContext {
  activeTheme: ITheme<string>;
  availableThemes: ITheme[];
  addTheme(theme: ITheme): void;
  changeTheme(themeName: string): void;
}

export default createContext<IThemeContext>({} as IThemeContext);
