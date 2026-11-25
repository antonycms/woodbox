import { create } from 'zustand';
import defaultTheme from '@renderer/styles/theme/default';
import type { ITheme } from '@shared/types/theme';
import { builtinThemeNames, builtinThemes } from '@renderer/styles/theme/builtin';
import { getThemeColor, parseThemeColors, themeColorPaths } from '@shared/theme/colors';
import { readStorageValue, writeStorageValue } from '@renderer/utils/storage';
import { useI18nStore } from '@renderer/stores/I18n';

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

  for (const [path, value] of Object.entries(parseThemeColors(colors))) {
    const keys = path.split('.');
    const lastKey = keys.pop();
    let target = clonedTheme as unknown as Record<string, unknown>;

    for (const key of keys) {
      if (!Object.hasOwn(target, key) || !target[key] || typeof target[key] !== 'object') {
        throw new Error(useI18nStore.getState().t('theme.colorPathUnavailable', { path }));
      }
      target = target[key] as Record<string, unknown>;
    }

    if (lastKey) target[lastKey] = value;
  }

  return clonedTheme;
};

const hasThemeColorChanges = (before: ITheme, after: ITheme) =>
  themeColorPaths.some((path) => getThemeColor(before, path)?.toLowerCase() !== getThemeColor(after, path)?.toLowerCase());

export const useThemeStore = create<IThemeStore>()((set, get) => {
  let storedThemes = readStoredThemes();
  let activeThemeName = readActiveThemeName();
  const availableThemes = availableThemesFrom(storedThemes);

  const writeLocalThemes = () => {
    writeStorageValue('@theme:available', storedThemes);
    writeStorageValue('@theme:active', activeThemeName);
  };

  const updateThemes = (options: { persist?: boolean } = {}) => {
    const availableThemes = availableThemesFrom(storedThemes);
    set({
      availableThemes,
      activeTheme: availableThemes.find((theme) => theme.name === activeThemeName) || defaultTheme,
    });
    if (options.persist !== false) writeLocalThemes();
  };

  return {
    availableThemes,
    activeTheme: availableThemes.find((theme) => theme.name === activeThemeName) || defaultTheme,
    syncFromStorage: () => {
      storedThemes = readStoredThemes();
      activeThemeName = readActiveThemeName();
      updateThemes({ persist: false });
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
      if (!activeTheme) throw new Error(useI18nStore.getState().t('theme.invalid'));
      activeThemeName = name;
      set({ activeTheme });
      writeLocalThemes();
    },
    createThemeFromColors: (themeName, colors, baseThemeName) => {
      const { activeTheme, availableThemes } = get();
      const normalizedName = themeName.trim().toLowerCase();
      const t = useI18nStore.getState().t;
      if (!normalizedName) throw new Error(t('theme.invalid'));
      if (
        normalizedName === currentCustomThemeName.toLowerCase() ||
        availableThemes.some((theme) => theme.name.toLowerCase() === normalizedName)
      ) {
        throw new Error(t('theme.nameAlreadyUsed'));
      }

      const baseTheme = baseThemeName
        ? availableThemes.find((theme) => theme.name === baseThemeName)
        : activeTheme;
      if (!baseTheme) throw new Error(t('theme.invalid'));

      const theme = { ...cloneWithColorPaths(baseTheme, colors), name: themeName.trim() };
      if (!hasThemeColorChanges(activeTheme, theme)) throw new Error(t('theme.noColorChanges'));
      storedThemes = [...storedThemes, theme];
      activeThemeName = theme.name;
      updateThemes();
    },
    updateActiveThemeColors: (colors) => {
      const activeTheme = get().activeTheme;
      const themeName = builtinThemeNames.includes(activeTheme.name)
        ? currentCustomThemeName
        : activeTheme.name;
      const theme = { ...cloneWithColorPaths(activeTheme, colors), name: themeName };
      if (!hasThemeColorChanges(activeTheme, theme)) return false;
      storedThemes = [...storedThemes.filter((item) => item.name !== theme.name), theme];
      activeThemeName = theme.name;
      updateThemes();
      return true;
    },
  };
});
