import type { IColumn, TableSearchOptions } from './dtos';

export const cellKey = (rowIndex: number, colIndex: number) => `${rowIndex}:${colIndex}`;

export const parseClipboardGrid = (text: string) => {
  const normalizedText = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');

  return normalizedText.split('\n').map((line) => line.split('\t'));
};

const isSearchWordChar = (char?: string) => {
  if (!char) return false;

  return /[\p{L}\p{N}_]/u.test(char);
};

export const findSearchIndex = (
  value: string,
  query: string,
  { matchCase, wholeWord }: TableSearchOptions,
  startIndex = 0,
) => {
  if (!query) return -1;

  const searchableValue = matchCase ? value : value.toLocaleLowerCase();
  const searchableQuery = matchCase ? query : query.toLocaleLowerCase();
  let index = searchableValue.indexOf(searchableQuery, startIndex);

  while (index !== -1) {
    const before = value[index - 1];
    const after = value[index + query.length];
    const isWholeWord = !isSearchWordChar(before) && !isSearchWordChar(after);

    if (!wholeWord || isWholeWord) return index;

    index = searchableValue.indexOf(searchableQuery, index + query.length);
  }

  return -1;
};

export const replaceSearchValue = (
  value: string,
  query: string,
  replace: string,
  options: TableSearchOptions,
  replaceAll: boolean,
) => {
  let nextValue = '';
  let startIndex = 0;

  while (startIndex <= value.length) {
    const foundIndex = findSearchIndex(value, query, options, startIndex);

    if (foundIndex === -1) {
      nextValue += value.slice(startIndex);
      break;
    }

    nextValue += value.slice(startIndex, foundIndex) + replace;
    startIndex = foundIndex + query.length;

    if (!replaceAll) {
      nextValue += value.slice(startIndex);
      break;
    }
  }

  return nextValue;
};

export const serializeTableValue = (
  value: any,
  type?: IColumn['type'],
  options?: { nullAsEmpty?: boolean },
): string => {
  if (value === undefined || (options?.nullAsEmpty && value === null)) return '';
  if (Array.isArray(value) && type === 'autocomplete-multi') return value.join(', ');
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

export const serializeTableCopyValue = (value: any): string => {
  if (value === undefined) return '';
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};
