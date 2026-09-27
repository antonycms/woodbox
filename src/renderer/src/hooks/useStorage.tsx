import { useState, useCallback } from 'react';
import { readStorageValue, writeStorageValue, type StorageOptions } from '@renderer/utils/storage';

export default function useStorage<T = unknown>(
  key: string,
  initialValue: T,
  options?: StorageOptions,
) {
  const [state, setState] = useState<T>(() => readStorageValue(key, initialValue, options));

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (valueOrCallback) => {
      setState((prevState) => {
        const value =
          typeof valueOrCallback === 'function'
            ? (valueOrCallback as (previous: T) => T)(prevState)
            : valueOrCallback;

        return writeStorageValue(key, value, options) ? value : prevState;
      });
    },
    [key, options?.saveOnSessionStorage],
  );

  return [state, setValue] as const;
}
