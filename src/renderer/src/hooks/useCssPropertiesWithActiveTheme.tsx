import type { DependencyList } from 'react';
import type { ITheme } from '@renderer/styles/theme/theme';
import { useThemeStore } from '@renderer/stores/Theme';
import { useCssProperties } from './useCssProperties';

export const useCssPropertiesWithActiveTheme = (
  callback: (activeTheme: ITheme) => object,
  arrDependencies?: DependencyList,
) => {
  const activeTheme = useThemeStore((state) => state.activeTheme);
  return useCssProperties(() => callback(activeTheme), [activeTheme, ...(arrDependencies || [])]);
};
