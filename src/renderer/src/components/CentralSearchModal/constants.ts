import type {
  ICentralSearchItem,
  ICentralSearchItemType,
  ICentralSearchRow,
  IParsedSearch,
} from './dtos';
import type { IConnectionPublic as IConnection } from '@shared/types/connections';

export const containerElement = document.getElementById('modal-root');

export const SECTION_ROW_HEIGHT = 33;

export const ITEM_ROW_HEIGHT = 52;

export const ITEM_TYPE_ORDER: Record<ICentralSearchItemType, number> = {
  script: 0,
  table: 1,
  function: 2,
};

export const EMPTY_CONNECTIONS_BY_ID = new Map<string, IConnection>();

export const EMPTY_OPEN_TAB_RESULT: {
  openTabItems: ICentralSearchItem[];
  openTabIds: Set<string>;
} = {
  openTabItems: [],
  openTabIds: new Set(),
};

export const EMPTY_CLOSED_ITEMS: Record<ICentralSearchItemType, ICentralSearchItem[]> = {
  script: [],
  table: [],
  function: [],
};

export const EMPTY_VISIBLE_RESULT: {
  visibleItems: ICentralSearchItem[];
  visibleRows: ICentralSearchRow[];
} = {
  visibleItems: [],
  visibleRows: [],
};

export function getScriptTabId(idScript: string) {
  return `script_${idScript}`;
}

export function getTableTabId(idConnection: string, schema: string | undefined, table: string) {
  return `${idConnection}_${schema}_${table}`;
}

export function getFunctionTabId(
  idConnection: string,
  schema: string | undefined,
  functionName: string,
) {
  return `fn_${idConnection}_${schema}_${functionName}`;
}

export function getQualifiedName(schema: string | undefined, name: string) {
  return schema ? `${schema}.${name}` : name;
}

export function normalizeSearch(value: string) {
  return (value || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim();
}

export function normalizeCompactSearch(value: string) {
  return normalizeSearch(value).replace(/[\s_.-]+/g, '');
}

export function parseSearchText(value: string): IParsedSearch {
  const match = value.trim().match(/^(\S+)(?:\s+([\s\S]+))?$/);

  return {
    filter: match?.[1] || '',
    argument: match?.[2]?.trim(),
  };
}

export function makeSearchItem(
  item: Omit<ICentralSearchItem, 'search' | 'compactSearch'>,
): ICentralSearchItem {
  const title = item.title || item.searchableTitle || '';
  const search = normalizeSearch(`${item.searchableTitle || title} ${item.connectionDescription}`);

  return {
    ...item,
    title,
    searchableTitle: item.searchableTitle || title,
    search,
    compactSearch: normalizeCompactSearch(search),
  };
}

export function sortByTitle(a: ICentralSearchItem, b: ICentralSearchItem) {
  return (a.title || '').localeCompare(b.title || '');
}

export function sortByTypeThenTitle(a: ICentralSearchItem, b: ICentralSearchItem) {
  return ITEM_TYPE_ORDER[a.type] - ITEM_TYPE_ORDER[b.type] || sortByTitle(a, b);
}

export function sortBySearchRelevance(items: ICentralSearchItem[], filter: string) {
  if (!filter) return items;

  const compactFilter = normalizeCompactSearch(filter);
  const scoredItems = items.map((item) => ({
    item,
    score: getSearchScore(item, filter, compactFilter),
  }));

  scoredItems.sort((a, b) => {
    return (
      a.score.rank - b.score.rank ||
      a.score.distance - b.score.distance ||
      sortByTitle(a.item, b.item)
    );
  });

  return scoredItems.map(({ item }) => item);
}

function getSearchDistance(
  title: string,
  objectName: string,
  connection: string,
  compactTitle: string,
  compactObjectName: string,
  compactConnection: string,
  filter: string,
  compactFilter: string,
) {
  return Math.min(
    getTextMatchDistance(objectName, filter),
    getTextMatchDistance(title, filter),
    getTextMatchDistance(connection, filter),
    compactFilter ? getTextMatchDistance(compactObjectName, compactFilter) : Number.MAX_SAFE_INTEGER,
    compactFilter ? getTextMatchDistance(compactTitle, compactFilter) : Number.MAX_SAFE_INTEGER,
    compactFilter ? getTextMatchDistance(compactConnection, compactFilter) : Number.MAX_SAFE_INTEGER,
  );
}

function getTextMatchDistance(value: string, filter: string) {
  if (!filter) return 0;
  if (value === filter) return 0;
  if (value.startsWith(filter)) return value.length - filter.length;

  const index = value.indexOf(filter);

  if (index >= 0) return value.length - filter.length + index;

  return Number.MAX_SAFE_INTEGER;
}

function getSearchScore(item: ICentralSearchItem, filter: string, compactFilter: string) {
  const title = normalizeSearch(item.searchableTitle);
  const objectName = title.split('.').pop() || title;
  const connection = normalizeSearch(item.connectionDescription);
  const compactTitle = normalizeCompactSearch(title);
  const compactObjectName = normalizeCompactSearch(objectName);
  const compactConnection = normalizeCompactSearch(connection);

  return {
    rank: getSearchRank(
      title,
      objectName,
      connection,
      compactTitle,
      compactObjectName,
      compactConnection,
      filter,
      compactFilter,
    ),
    distance: getSearchDistance(
      title,
      objectName,
      connection,
      compactTitle,
      compactObjectName,
      compactConnection,
      filter,
      compactFilter,
    ),
  };
}

function getSearchRank(
  title: string,
  objectName: string,
  connection: string,
  compactTitle: string,
  compactObjectName: string,
  compactConnection: string,
  filter: string,
  compactFilter: string,
) {
  const hasCompactFilter = compactFilter.length > 0;

  if (objectName === filter) return 0;
  if (title === filter) return 1;
  if (hasCompactFilter && compactObjectName === compactFilter) return 2;
  if (hasCompactFilter && compactTitle === compactFilter) return 3;
  if (objectName.startsWith(filter)) return 4;
  if (title.startsWith(filter)) return 5;
  if (hasCompactFilter && compactObjectName.startsWith(compactFilter)) return 6;
  if (hasCompactFilter && compactTitle.startsWith(compactFilter)) return 7;
  if (objectName.includes(filter)) return 8;
  if (title.includes(filter)) return 9;
  if (hasCompactFilter && compactObjectName.includes(compactFilter)) return 10;
  if (hasCompactFilter && compactTitle.includes(compactFilter)) return 11;
  if (connection.startsWith(filter)) return 12;
  if (hasCompactFilter && compactConnection.startsWith(compactFilter)) return 13;

  return 14;
}

export function getRowSize(row: ICentralSearchRow) {
  return row.type === 'section' ? SECTION_ROW_HEIGHT : ITEM_ROW_HEIGHT;
}

export function getRowOffsets(rows: ICentralSearchRow[]) {
  let offset = 0;

  return rows.map((row) => {
    const rowOffset = offset;
    offset += getRowSize(row);

    return rowOffset;
  });
}
