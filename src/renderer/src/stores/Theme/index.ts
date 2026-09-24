import { create } from 'zustand';
import defaultTheme from '@renderer/styles/theme/default';
import type { ITheme } from '@renderer/styles/theme/theme';
import { builtinThemes } from '@renderer/styles/theme/builtin';
import { readStorageValue, writeStorageValue } from '@renderer/utils/storage';

import type { IThemeStore } from './types';

const currentCustomThemeName = 'Personalizado atual';

const availableThemesFrom = (stored: ITheme[]) => {
  const builtinNames = new Set(builtinThemes.map((theme) => theme.name));
  return [...builtinThemes, ...stored.filter((theme) => !builtinNames.has(theme.name))];
};

const cloneWithColorPaths = (theme: ITheme, colors: Record<string, string>): ITheme => {
  const clonedTheme = JSON.parse(JSON.stringify(theme)) as ITheme;

  for (const [path, value] of Object.entries(colors)) {
    const keys = path.split('.').filter(Boolean);
    const lastKey = keys.pop();
    let target = clonedTheme as unknown as Record<string, unknown>;

    if (!lastKey) continue;

    for (const key of keys) {
      if (!target[key] || typeof target[key] !== 'object') target[key] = {};
      target = target[key] as Record<string, unknown>;
    }

    target[lastKey] = value;
  }

  return clonedTheme;
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
    createThemeFromColors: (themeName, colors, baseThemeName) => {
      const baseTheme =
        get().availableThemes.find((theme) => theme.name === baseThemeName) || get().activeTheme;
      const theme = { ...cloneWithColorPaths(baseTheme, colors), name: themeName };
      storedThemes = [...storedThemes.filter((item) => item.name !== theme.name), theme];
      activeThemeName = theme.name;
      updateThemes();
    },
    updateActiveThemeColors: (colors) => {
      const activeTheme = get().activeTheme;
      const builtinThemeNames = new Set(builtinThemes.map((theme) => theme.name));
      const themeName = builtinThemeNames.has(activeTheme.name)
        ? currentCustomThemeName
        : activeTheme.name;
      const theme = { ...cloneWithColorPaths(activeTheme, colors), name: themeName };
      storedThemes = [...storedThemes.filter((item) => item.name !== theme.name), theme];
      activeThemeName = theme.name;
      updateThemes();
    },
  };
});
