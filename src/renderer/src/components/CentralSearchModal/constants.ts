import type {
  ICentralSearchItem,
  ICentralSearchItemType,
  ICentralSearchRow,
  IParsedSearch,
} from './dtos';

export const containerElement = document.getElementById('modal-root');

export const SECTION_ROW_HEIGHT = 33;

export const ITEM_ROW_HEIGHT = 52;

export const ITEM_TYPE_ORDER: Record<ICentralSearchItemType, number> = {
  script: 0,
  table: 1,
  function: 2,
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

export function parseSearchText(value: string): IParsedSearch {
  const match = value.trim().match(/^(\S+)(?:\s+([\s\S]+))?$/);

  return {
    filter: match?.[1] || '',
    argument: match?.[2]?.trim(),
  };
}

export function makeSearchItem(item: Omit<ICentralSearchItem, 'search'>): ICentralSearchItem {
  return {
    ...item,
    search: normalizeSearch(`${item.searchableTitle} ${item.connectionDescription}`),
  };
}

export function sortByTitle(a: ICentralSearchItem, b: ICentralSearchItem) {
  return a.title.localeCompare(b.title);
}

export function sortByTypeThenTitle(a: ICentralSearchItem, b: ICentralSearchItem) {
  return ITEM_TYPE_ORDER[a.type] - ITEM_TYPE_ORDER[b.type] || sortByTitle(a, b);
}

export function sortBySearchRelevance(items: ICentralSearchItem[], filter: string) {
  if (!filter) return items;

  return [...items].sort((a, b) => {
    const rankA = getSearchRank(a, filter);
    const rankB = getSearchRank(b, filter);

    return rankA - rankB || sortByTitle(a, b);
  });
}

export function getSearchRank(item: ICentralSearchItem, filter: string) {
  const title = normalizeSearch(item.searchableTitle);
  const objectName = title.split('.').pop() || title;
  const connection = normalizeSearch(item.connectionDescription);

  if (objectName === filter) return 0;
  if (objectName.startsWith(filter)) return 1;
  if (title === filter) return 2;
  if (title.startsWith(filter)) return 3;
  if (objectName.includes(filter)) return 4;
  if (title.includes(filter)) return 5;
  if (connection.startsWith(filter)) return 6;

  return 7;
}

export function getRowSize(row: ICentralSearchRow) {
  return row.type === 'section' ? SECTION_ROW_HEIGHT : ITEM_ROW_HEIGHT;
}

export function getRowOffset(rows: ICentralSearchRow[], indexTarget: number) {
  let offset = 0;

  for (let index = 0; index < indexTarget; index++) {
    offset += getRowSize(rows[index]);
  }

  return offset;
}
