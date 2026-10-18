import type { ITheme } from '@renderer/styles/theme';
import type { TranslateFn, TranslateTextFn } from '@renderer/stores/I18n/types';

export const currentCustomThemeName = 'Personalizado atual';
export const defaultThemeName = 'default-theme';

const themeLabels = {
  'woodbox-graphite': 'Grafite',
  'woodbox-amber': 'Âmbar',
  dracula: 'Dracula',
  'one-dark-pro': 'One Dark Pro',
  'github-dark': 'GitHub Dark',
  'catppuccin-mocha': 'Catppuccin Mocha',
  omni: 'Omni',
  'woodbox-aura-light': 'Aura Light',
  'one-light-pro': 'One Light Pro',
  'github-light': 'GitHub Light',
  'catppuccin-latte': 'Catppuccin Latte',
};

export const getThemeLabel = (theme: ITheme, t: TranslateFn, tText: TranslateTextFn) => {
  if (theme.name === currentCustomThemeName) return t('settings.customization.currentCustomTheme');
  if (theme.name === defaultThemeName) return t('settings.customization.defaultThemeLabel');

  return tText(themeLabels[theme.name]) || theme.name;
};
