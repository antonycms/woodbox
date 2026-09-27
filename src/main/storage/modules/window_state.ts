import type Store from 'electron-store';

export type WindowState = {
  width: number;
  height: number;
  x: number;
  y: number;
  isMaximized: boolean;
};

type AppStore = Store<Record<string, unknown>>;

const STORE_KEY = 'window_state';

export const initialValue = {
  type: ['object', 'null'],
  default: null,
} as const;

export const getModule = (store: AppStore) => {
  const get = (): WindowState | null => (store.get(STORE_KEY) as WindowState | null) ?? null;

  const save = (state: WindowState): void => {
    store.set(STORE_KEY, state);
  };

  return { get, save };
};
