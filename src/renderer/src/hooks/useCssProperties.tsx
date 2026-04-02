import { toCssProperties } from '@renderer/styles/theme';
import { useMemo } from 'react';

export const useCssProperties = (callback: () => object, arrDependencies: any[]) => {
  return useMemo(() => toCssProperties(callback()), arrDependencies);
};
