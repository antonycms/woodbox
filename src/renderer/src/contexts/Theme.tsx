import React from 'react';
import { ThemeProvider as StyledComponentThemeProvider } from 'styled-components';
import { ITheme } from '@renderer/styles/theme';
import themes from '@renderer/styles/theme';

const ThemeContext = React.createContext<IThemeContext>({} as IThemeContext);

const ThemeProvider = ({ children }: IThemeProviderProps) => {
  const [activeTheme, setActiveTheme] = React.useState<ITheme>('dark');

  return (
    <ThemeContext.Provider value={{ activeTheme, setActiveTheme }}>
      <StyledComponentThemeProvider theme={themes[activeTheme]}>
        {children}
      </StyledComponentThemeProvider>
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  return React.useContext(ThemeContext);
};

export default ThemeProvider;

interface IThemeProviderProps {
  children?: React.ReactNode;
}

interface IThemeContext {
  activeTheme: ITheme;
  setActiveTheme: React.Dispatch<ITheme>;
}
