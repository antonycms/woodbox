import type { ITheme } from './theme';
import defaultTheme from './default';
import { serializeTheme } from './utils';

export * from './utils';
export type { ITheme };
export default serializeTheme(defaultTheme);
