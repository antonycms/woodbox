import React from 'react';
import IconColumns from '~icons/tabler/columns-3';
import IconChevron from '~icons/tabler/chevron-down';
import { useI18nStore } from '@renderer/stores/I18n';
import { matchesSearchText, prepareSearchText } from '@renderer/utils/searchText';
import styles from './styles.module.css';

export interface ColumnVisibilityMenuProps {
  columns: { id: string; label: string }[];
  hiddenColumns: ReadonlySet<string>;
  onToggleColumn(column: string): void;
  onShowAll(): void;
  onHideAll(): void;
}

export function ColumnVisibilityMenu({
  columns,
  hiddenColumns,
  onToggleColumn,
  onShowAll,
  onHideAll,
}: ColumnVisibilityMenuProps) {
  const t = useI18nStore((state) => state.t);
  const [open, setOpen] = React.useState(false);
  const [query, setQuery] = React.useState('');
  const rootRef = React.useRef<HTMLDivElement>(null);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  const menuId = React.useId();
  const visibleCount = columns.length - hiddenColumns.size;
  const matchingColumns = React.useMemo(() => {
    const filter = prepareSearchText(query);
    return columns.filter(({ id, label }) =>
      matchesSearchText(prepareSearchText(label), filter) ||
      (label !== id && matchesSearchText(prepareSearchText(id), filter)),
    );
  }, [columns, query]);

  React.useEffect(() => {
    if (!open) return;

    const closeOutside = (event: Event) => {
      if (!rootRef.current?.contains(event.target as Node)) setOpen(false);
    };
    document.addEventListener('pointerdown', closeOutside);
    document.addEventListener('focusin', closeOutside);
    return () => {
      document.removeEventListener('pointerdown', closeOutside);
      document.removeEventListener('focusin', closeOutside);
    };
  }, [open]);

  return (
    <div
      ref={rootRef}
      className={styles.root}
      onKeyDown={(event) => {
        if (!open || event.key !== 'Escape') return;
        event.preventDefault();
        event.stopPropagation();
        setOpen(false);
        buttonRef.current?.focus();
      }}
    >
      <button
        ref={buttonRef}
        type="button"
        className={styles.trigger}
        data-customized={hiddenColumns.size > 0}
        aria-expanded={open}
        aria-controls={open ? menuId : undefined}
        disabled={!columns.length}
        onClick={() => {
          if (!open) setQuery('');
          setOpen(!open);
        }}
      >
        <IconColumns aria-hidden="true" />
        {t('table.columnVisibility')}
        <span>{visibleCount}/{columns.length}</span>
        <IconChevron aria-hidden="true" />
      </button>

      {open && (
        <div id={menuId} className={styles.panel} role="group" aria-label={t('table.visibleColumns')}>
          <strong>{t('table.visibleColumns')}</strong>
          <input
            autoFocus
            type="search"
            spellCheck={false}
            placeholder={t('table.searchColumns')}
            aria-label={t('table.searchColumns')}
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />
          <div className={styles.list}>
            {matchingColumns.length ? matchingColumns.map(({ id, label }) => {
              const checked = !hiddenColumns.has(id);
              return (
                <label key={id} title={label}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggleColumn(id)}
                  />
                  <span>{label}</span>
                </label>
              );
            }) : <div className={styles.empty}>{t('table.noMatchingColumns')}</div>}
          </div>
          <div className={styles.actions}>
            <button type="button" onClick={onShowAll} disabled={!hiddenColumns.size}>
              {t('table.showAllColumns')}
            </button>
            <button type="button" onClick={onHideAll} disabled={!visibleCount}>
              {t('table.hideAllColumns')}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
