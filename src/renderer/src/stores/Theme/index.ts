import { create } from 'zustand';
import defaultTheme from '@renderer/styles/theme/default';
import type { ITheme } from '@renderer/styles/theme/theme';
import { builtinThemes } from '@renderer/styles/theme/builtin';
import { readStorageValue, writeStorageValue } from '@renderer/utils/storage';

import type { IThemeStore } from './types';

const availableThemesFrom = (stored: ITheme[]) => {
  const builtinNames = new Set(builtinThemes.map((theme) => theme.name));
  return [...builtinThemes, ...stored.filter((theme) => !builtinNames.has(theme.name))];
};

export const useThemeStore = create<IThemeStore>()((set, get) => {
  let storedThemes = readStorageValue<ITheme[]>('@theme:available', []);
  let activeThemeName = readStorageValue('@theme:active', defaultTheme.name);
  const availableThemes = availableThemesFrom(storedThemes);

  const updateThemes = () => {
    const availableThemes = availableThemesFrom(storedThemes);
    set({
      availableThemes,
      activeTheme: availableThemes.find((theme) => theme.name === activeThemeName) || defaultTheme,
    });
    writeStorageValue('@theme:available', storedThemes);
    writeStorageValue('@theme:active', activeThemeName);
  };

  return {
    availableThemes,
    activeTheme: availableThemes.find((theme) => theme.name === activeThemeName) || defaultTheme,
    addTheme: (theme, options) => {
      storedThemes = [...storedThemes.filter((item) => item.name !== theme.name), theme];
      if (options?.activate) activeThemeName = theme.name;
      updateThemes();
    },
    removeTheme: (name, fallback = defaultTheme.name) => {
      storedThemes = storedThemes.filter((theme) => theme.name !== name);
      if (activeThemeName === name) activeThemeName = fallback;
      updateThemes();
    },
    changeTheme: (name) => {
      const activeTheme = get().availableThemes.find((theme) => theme.name === name);
      if (!activeTheme) throw new Error('Tema inválido.');
      activeThemeName = name;
      set({ activeTheme });
      writeStorageValue('@theme:active', name);
    },
  };
});
