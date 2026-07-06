import { toCssProperties } from '@renderer/styles/theme';
import { useMemo, type DependencyList } from 'react';

export const useCssProperties = (callback: () => object, arrDependencies: DependencyList) => {
  return useMemo(() => toCssProperties(callback()), arrDependencies);
};
