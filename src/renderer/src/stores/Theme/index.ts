import { create } from 'zustand';
import defaultTheme from '@renderer/styles/theme/default';
import type { ITheme } from '@renderer/styles/theme/theme';
import { builtinThemes } from '@renderer/styles/theme/builtin';
import { readStorageValue, writeStorageValue } from '@renderer/utils/storage';

import type { IThemeStore } from './types';

const currentCustomThemeName = 'Personalizado atual';

const isTheme = (value: unknown): value is ITheme => {
  return !!value && typeof value === 'object' && typeof (value as { name?: unknown }).name === 'string';
};

const readStoredThemes = () => {
  const stored = readStorageValue<unknown>('@theme:available', []);

  return Array.isArray(stored) ? stored.filter(isTheme) : [];
};

const readActiveThemeName = () => {
  const stored = readStorageValue<unknown>('@theme:active', defaultTheme.name);

  return typeof stored === 'string' ? stored : defaultTheme.name;
};

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
  let storedThemes = readStoredThemes();
  let activeThemeName = readActiveThemeName();
  const availableThemes = availableThemesFrom(storedThemes);

  const writeLocalThemes = () => {
    writeStorageValue('@theme:available', storedThemes);
    writeStorageValue('@theme:active', activeThemeName);
  };

  const persistThemes = () => {
    writeLocalThemes();
    void window.api.preferences
      .set({ customThemes: storedThemes, themeActiveName: activeThemeName })
      .catch(console.error);
  };

  const updateThemes = (options: { persist?: boolean } = {}) => {
    const availableThemes = availableThemesFrom(storedThemes);
    set({
      availableThemes,
      activeTheme: availableThemes.find((theme) => theme.name === activeThemeName) || defaultTheme,
    });
    if (options.persist === false) {
      writeLocalThemes();
    } else {
      persistThemes();
    }
  };

  return {
    availableThemes,
    activeTheme: availableThemes.find((theme) => theme.name === activeThemeName) || defaultTheme,
    hydrate: async () => {
      const preferences = await window.api.preferences.get();
      const hasStoredPreferences =
        Array.isArray(preferences.customThemes) || typeof preferences.themeActiveName === 'string';

      if (Array.isArray(preferences.customThemes)) {
        storedThemes = preferences.customThemes.filter(isTheme);
      }

      if (typeof preferences.themeActiveName === 'string') {
        activeThemeName = preferences.themeActiveName;
      }

      updateThemes({ persist: !hasStoredPreferences });
    },
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
      persistThemes();
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
