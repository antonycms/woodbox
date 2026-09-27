import type { AppPreferences, AppPreferencesPatch } from '@shared/types/preferences';
import type Store from 'electron-store';

type AppStore = Store<Record<string, unknown>>;

const STORE_KEY = 'app_preferences';

export const initialValue = {
  type: 'object',
  default: {},
  additionalProperties: true,
} as const;

export const getModule = (store: AppStore) => {
  const get = (): AppPreferences => (store.get(STORE_KEY) as AppPreferences | undefined) ?? {};

  const update = (preferences: AppPreferencesPatch): void => {
    store.set(STORE_KEY, { ...get(), ...preferences });
  };

  return { get, update };
};
