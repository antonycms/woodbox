import type { ITheme } from '../types/theme';
import { builtinThemes } from './index';

const collectColorPaths = (value: object, prefix: string, paths: Set<string>) => {
  for (const [key, child] of Object.entries(value)) {
    if (!prefix && key === 'name') continue;
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof child === 'string') paths.add(path);
    else if (child && typeof child === 'object') collectColorPaths(child, path, paths);
  }
};

const colorPaths = new Set<string>();
for (const theme of builtinThemes) collectColorPaths(theme, '', colorPaths);

export const themeColorPaths = [...colorPaths].sort();

export const getThemeColor = (theme: ITheme, path: string) => {
  let value: unknown = theme;
  for (const key of path.split('.')) {
    if (!value || typeof value !== 'object' || !Object.hasOwn(value, key)) return undefined;
    value = (value as Record<string, unknown>)[key];
  }
  return typeof value === 'string' ? value : undefined;
};

export const snapshotThemeColors = (theme: ITheme): Record<string, string> =>
  Object.fromEntries(themeColorPaths.flatMap((path) => {
    const color = getThemeColor(theme, path);
    return color === undefined ? [] : [[path, color]];
  }));

export const parseThemeColors = (input: unknown): Record<string, string> => {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Informe as cores como um mapa de caminhos para valores hexadecimais.');
  }

  const entries = Object.entries(input);
  const invalidPaths = entries.filter(([path]) => !colorPaths.has(path)).map(([path]) => path);
  if (invalidPaths.length) {
    throw new Error(`Campos de cor desconhecidos: ${invalidPaths.join(', ')}. Consulte list_theme_options.`);
  }

  const invalidColors = entries
    .filter(([, value]) => typeof value !== 'string' || !/^#[\da-f]{6}(?:[\da-f]{2})?$/i.test(value))
    .map(([path]) => path);
  if (invalidColors.length) {
    throw new Error(`Use cores #RRGGBB ou #RRGGBBAA nestes campos: ${invalidColors.join(', ')}.`);
  }

  return Object.fromEntries(entries) as Record<string, string>;
};
