import type { IColumn, ITableSort } from '@renderer/components/Table/dtos';
import { TranslateFn } from '@renderer/stores/I18n/types';
import type { IDatabaseProcess } from '@shared/types/database';
import { sortRows } from '@renderer/utils/tableSort';

export type ProcessListRow = Omit<IDatabaseProcess, 'is_current'> & { actions?: string };

const normalizeText = (value: unknown) => String(value ?? '').toLocaleLowerCase();

const getFilterTerms = (filter: string) =>
  filter
    .trim()
    .split(/\s+/)
    .map((term) => term.toLocaleLowerCase())
    .filter(Boolean);

const matchesFilter = (row: ProcessListRow, terms: string[]) => {
  if (!terms.length) return true;

  const values = Object.values(row).map(normalizeText);

  return terms.every((term) => values.some((value) => value.includes(term)));
};

export const getProcessListColumns = (t: TranslateFn): IColumn<ProcessListRow>[] => [
  { label: t('processList.pid'), attribute: 'pid', resizable: true, sortable: true },
  { label: t('processList.user'), attribute: 'username', resizable: true, sortable: true },
  {
    label: t('processList.database'),
    attribute: 'database',
    resizable: true,
    sortable: true,
  },
  { label: t('processList.client'), attribute: 'client', resizable: true, sortable: true },
  {
    label: t('processList.application'),
    attribute: 'application',
    resizable: true,
    sortable: true,
  },
  { label: t('processList.state'), attribute: 'state', resizable: true, sortable: true },
  { label: t('processList.wait'), attribute: 'wait', resizable: true, sortable: true },
  {
    label: t('processList.durationSeconds'),
    attribute: 'duration_seconds',
    resizable: true,
    sortable: true,
    type: 'number',
  },
  { label: t('processList.query'), attribute: 'query', resizable: true, sortable: true },
];

export const getFilteredProcessListRows = (
  rows: ProcessListRow[],
  filter: string,
  sort: ITableSort[],
) => {
  const terms = getFilterTerms(filter);

  return sortRows(rows.filter((row) => matchesFilter(row, terms)), sort);
};

export const normalizeProcessRow = (row: IDatabaseProcess): ProcessListRow => ({
  pid: row.pid ?? '—',
  username: row.username || '—',
  database: row.database || '—',
  client: row.client || '—',
  application: row.application || '—',
  state: row.state || '—',
  wait: row.wait || '—',
  duration_seconds: Number(row.duration_seconds ?? 0),
  query: row.query || '—',
});
