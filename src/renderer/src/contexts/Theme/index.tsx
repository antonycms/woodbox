import React from 'react';

import useStorage from '@renderer/hooks/useStorage';
import defaultTheme, { applyMonacoTheme, ITheme } from '@renderer/styles/theme';
import { builtinThemes } from '@renderer/styles/theme/builtin';
import { useCssProperties } from '@renderer/hooks/useCssProperties';
import ThemeContext, { type IThemeProviderProps } from './context';
export type * from './context';

const ThemeProvider = ({ children }: IThemeProviderProps) => {
  const [activeThemeName, setActiveThemeName] = useStorage<string>(
    '@theme:active',
    defaultTheme.name,
  );
  const [storedThemes, setStoredThemes] = useStorage<ITheme[]>('@theme:available', []);

  const availableThemes = React.useMemo(() => {
    const builtinNames = new Set(builtinThemes.map((theme) => theme.name));
    const customThemes = storedThemes.filter((theme) => !builtinNames.has(theme.name));

    return [...builtinThemes, ...customThemes];
  }, [storedThemes]);

  const activeTheme = React.useMemo(() => {
    return availableThemes.find((theme) => theme.name === activeThemeName) || defaultTheme;
  }, [availableThemes, activeThemeName]);

  const addTheme = React.useCallback(
    (theme: ITheme, options?: { activate?: boolean }) => {
      setStoredThemes((prevState) => [...prevState.filter((t) => t.name !== theme.name), theme]);

      if (options?.activate) {
        setActiveThemeName(theme.name);
      }
    },
    [setActiveThemeName, setStoredThemes],
  );

  const removeTheme = React.useCallback(
    (themeName: string, fallbackThemeName = defaultTheme.name) => {
      setStoredThemes((prevState) => prevState.filter((theme) => theme.name !== themeName));

      if (activeThemeName === themeName) {
        setActiveThemeName(fallbackThemeName);
      }
    },
    [activeThemeName, setActiveThemeName, setStoredThemes],
  );

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
    <ThemeContext.Provider
      value={{ activeTheme, availableThemes, addTheme, removeTheme, changeTheme }}
    >
      {children}
    </ThemeContext.Provider>
  );
};

export const useThemeContext = () => {
  return React.useContext(ThemeContext);
};

export const useCssPropertiesWithActiveTheme = (
  callback: (activeTheme: ITheme) => object,
  arrDependencies?: React.DependencyList,
) => {
  const { activeTheme } = useThemeContext();

  return useCssProperties(() => callback(activeTheme), [activeTheme, ...(arrDependencies || [])]);
};

export default ThemeProvider;
