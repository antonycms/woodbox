export interface StorageOptions {
  saveOnSessionStorage?: boolean;
}

export function readStorageValue<T>(key: string, fallback: T, options?: StorageOptions): T {
  try {
    const storage = options?.saveOnSessionStorage ? window.sessionStorage : window.localStorage;
    const value = storage.getItem(key);
    return value === null ? fallback : JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function writeStorageValue(key: string, value: unknown, options?: StorageOptions): boolean {
  try {
    const storage = options?.saveOnSessionStorage ? window.sessionStorage : window.localStorage;
    storage.setItem(key, JSON.stringify(value));
    return true;
  } catch (error) {
    console.error(error);
    return false;
  }
}
