import { useState, useCallback } from 'react';

export default function useStorage<T = unknown>(key: string, initialValue: T, options?: IOptions) {
  const storage = options?.saveOnSessionStorage ? window.sessionStorage : window.localStorage;

  const [state, setState] = useState<T>(() => {
    try {
      const storagedValue = storage.getItem(key);
      return storagedValue ? JSON.parse(storagedValue) : initialValue;
    } catch (error) {
      return initialValue;
    }
  });

  const setValue: React.Dispatch<React.SetStateAction<T>> = useCallback(
    (valueOrCallback) => {
      try {
        setState((prevState) => {
          let value = valueOrCallback;

          if (typeof valueOrCallback === 'function') {
            const functionSetState = valueOrCallback as CallbackSetState<T>;
            value = functionSetState(prevState);
          }

          storage.setItem(key, JSON.stringify(value));

          return value as T;
        });
      } catch (error) {
        console.error(error);
      }
    },
    [key],
  );

  return [state, setValue] as const;
}

type CallbackSetState<T> = (prevState: T) => T;

interface IOptions {
  saveOnSessionStorage?: boolean;
}
