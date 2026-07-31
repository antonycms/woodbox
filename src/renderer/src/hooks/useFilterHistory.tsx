import React from 'react';

const FILTER_HISTORY_LIMIT = 8;
const FILTER_HISTORY_STORAGE_PREFIX = '@filter-history';

const getStorageKey = (parts: string[]) =>
  [FILTER_HISTORY_STORAGE_PREFIX, ...parts.map((part) => encodeURIComponent(part))].join(':');

const readHistory = (key: string) => {
  try {
    const value = window.localStorage.getItem(key);
    const history = value ? JSON.parse(value) : [];

    return Array.isArray(history) ? history.filter((item) => typeof item === 'string') : [];
  } catch (_error) {
    return [];
  }
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

        window.localStorage.setItem(storageKey, JSON.stringify(nextHistory));

        return nextHistory;
      });
    },
    [storageKey],
  );

  React.useEffect(() => {
    setHistory(readHistory(storageKey));
  }, [storageKey]);

  return [history, addFilterHistory] as const;
}
