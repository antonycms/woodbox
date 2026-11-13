import type Store from 'electron-store';

const STORE_KEY = 'update_preferences';

export const initialValue = {
  type: 'object',
  default: {},
  properties: { ignoredVersion: { type: 'string' } },
  additionalProperties: false,
} as const;

export const getModule = (store: Store<Record<string, unknown>>) => ({
  getIgnoredVersion: (): string | undefined => {
    const value = store.get(STORE_KEY);
    if (!value || typeof value !== 'object' || !('ignoredVersion' in value)) return undefined;
    return typeof value.ignoredVersion === 'string' ? value.ignoredVersion : undefined;
  },
  ignoreVersion: (version: string): void => {
    store.set(STORE_KEY, { ignoredVersion: version });
  },
});
