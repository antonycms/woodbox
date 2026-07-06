import React from 'react';

import useStorage from '@renderer/hooks/useStorage';
import defaultTheme, { applyMonacoTheme, serializeTheme, ITheme } from '@renderer/styles/theme';
import { useCssProperties } from '@renderer/hooks/useCssProperties';
import ThemeContext, { type IThemeProviderProps } from './context';
export type * from './context';

const ThemeProvider = ({ children }: IThemeProviderProps) => {
  const [activeThemeName, setActiveThemeName] = useStorage<string>(
    '@theme:active',
    defaultTheme.name,
  );
  const [availableThemes, setAvailableThemes] = useStorage<ITheme<string>[]>('@theme:available', [
    defaultTheme,
  ]);

  const activeTheme = React.useMemo(() => {
    return availableThemes.find((theme) => theme.name === activeThemeName);
  }, [availableThemes, activeThemeName]);

  const addTheme = React.useCallback((theme: ITheme) => {
    setAvailableThemes((prevState) => [
      ...prevState.filter((t) => t.name !== theme.name),
      serializeTheme(theme),
    ]);
  }, []);

  const changeTheme = React.useCallback(
    (themeName: string) => {
      const themeExists = availableThemes.find(({ name }) => name === themeName);

      if (!themeExists) {
        throw new Error('Tema inválido.');
      }

      setActiveThemeName(themeName);
    },
    [availableThemes],
  );

  React.useEffect(() => {
    applyMonacoTheme(activeTheme);
  }, [activeTheme]);

  return (
    <ThemeContext.Provider value={{ activeTheme, availableThemes, addTheme, changeTheme }}>
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  return React.useContext(ThemeContext);
};

export const useCssPropertiesWithActiveTheme = (
  callback: (activeTheme: ITheme<string>) => object,
  arrDependencies?: React.DependencyList,
) => {
  const { activeTheme } = useThemeContext();

  return useCssProperties(() => callback(activeTheme), [activeTheme, ...(arrDependencies || [])]);
};

export default ThemeProvider;
