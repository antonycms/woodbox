import React from 'react';
import { readStorageValue, writeStorageValue } from '@renderer/utils/storage';

function readHiddenColumns(key: string): string[] {
  const value = readStorageValue<unknown>(key, []);
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
}

export function useColumnVisibility<Column extends { attribute: string; label: string }>(
  scope: readonly (string | null | undefined)[],
  columns: Column[],
  onChange?: () => void,
) {
  const key = `woodbox:table-hidden-columns:${JSON.stringify(scope)}`;
  const options = React.useMemo(
    () => columns.map(({ attribute, label }) => ({ id: attribute, label })),
    [columns],
  );
  const [preference, setPreference] = React.useState(() => ({ key, hidden: readHiddenColumns(key) }));
  const storedHidden = React.useMemo(
    () => (preference.key === key ? preference.hidden : readHiddenColumns(key)),
    [key, preference],
  );
  const hiddenColumns = React.useMemo(() => {
    const stored = new Set(storedHidden);
    return new Set(options.map(({ id }) => id).filter((id) => stored.has(id)));
  }, [options, storedHidden]);

  const save = React.useCallback(
    (hidden: string[]) => {
      onChange?.();
      setPreference({ key, hidden });
      writeStorageValue(key, hidden);
    },
    [key, onChange],
  );

  const toggleColumn = React.useCallback(
    (column: string) => {
      if (!options.some(({ id }) => id === column)) return;
      if (hiddenColumns.has(column)) {
        save([...hiddenColumns].filter((name) => name !== column));
      } else {
        save([...hiddenColumns, column]);
      }
    },
    [options, hiddenColumns, save],
  );
  const showAllColumns = React.useCallback(() => save([]), [save]);

  const hideAllColumns = React.useCallback(() => save(options.map(({ id }) => id)), [options, save]);

  const visibleColumns = React.useMemo(
    () => hiddenColumns.size
      ? columns.filter(({ attribute }) => !hiddenColumns.has(attribute))
      : columns,
    [columns, hiddenColumns],
  );

  return {
    visibleColumns,
    columnVisibility: {
      key,
      columns: options,
      hiddenColumns,
      onToggleColumn: toggleColumn,
      onShowAll: showAllColumns,
      onHideAll: hideAllColumns,
    },
  };
}
