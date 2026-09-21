import React from 'react';
import { readStorageValue, writeStorageValue } from '@renderer/utils/storage';

const FILTER_HISTORY_LIMIT = 8;
const FILTER_HISTORY_STORAGE_PREFIX = '@filter-history';

const getStorageKey = (parts: string[]) =>
  [FILTER_HISTORY_STORAGE_PREFIX, ...parts.map((part) => encodeURIComponent(part))].join(':');

const readHistory = (key: string) => {
  const history = readStorageValue<unknown>(key, []);
  return Array.isArray(history) ? history.filter((item): item is string => typeof item === 'string') : [];
};

export default function useFilterHistory(parts: string[]) {
  const storageKey = getStorageKey(parts);
  const [history, setHistory] = React.useState<string[]>(() => readHistory(storageKey));

  const addFilterHistory = React.useCallback(
    (value: string) => {
      const filter = value.trim();
      if (!filter) return;

      setHistory((prevState) => {
        const nextHistory = [
          filter,
          ...prevState.filter((item) => item !== filter),
        ].slice(0, FILTER_HISTORY_LIMIT);

        return writeStorageValue(storageKey, nextHistory) ? nextHistory : prevState;
      });
    },
    [storageKey],
  );

  React.useEffect(() => {
    setHistory(readHistory(storageKey));
  }, [storageKey]);

  return [history, addFilterHistory] as const;
}
