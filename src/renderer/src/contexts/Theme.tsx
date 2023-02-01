import React from 'react';
import useStorage from '@renderer/hooks/useStorage';

const ThemeContext = React.createContext<IThemeContext>({} as IThemeContext);

const ThemeProvider = ({ children }: IThemeProviderProps) => {
  const [activeThemeName, setActiveThemeName] = useStorage<string>('@theme:active','default-theme');
  const [availableThemes, setAvailableThemes] = useStorage<ITheme[]>('@theme:available', []);

  const activeTheme = React.useMemo(() => {
    return availableThemes.find(theme => theme.name === activeThemeName);
  }, [activeThemeName]);

  const addTheme = (theme: ITheme) => {
    const checkNameConflict = availableThemes.find(({ name }) => name === theme.name);

    if (checkNameConflict) {
      throw new Error('Já existe um tema com esse nome.');
    }

    setAvailableThemes(prevState => [...prevState, theme]);
  };

  const changeTheme = (themeName: string) => {
    const checkThemeExists = availableThemes.find(({ name }) => name === themeName);

    if (!checkThemeExists) {
      throw new Error('Tema inválido.');
    }

    setActiveThemeName(themeName);
  };

  return (
    <ThemeContext.Provider value={{ activeTheme, availableThemes, addTheme, changeTheme }}>
      {children}
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
  availableThemes: ITheme[];
  addTheme(theme: ITheme): void;
  changeTheme(themeName: string): void;
}

interface ITheme {
  name: string;
}
