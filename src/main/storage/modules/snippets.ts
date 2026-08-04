import type Store from 'electron-store';
import {
  makeFnAddItemInStoredArray,
  makeFnEditItemInStoredArray,
  makeFnGetItemInStoredArray,
  makeFnRemoveStoredItemFromArray,
} from '@main/storage/utils';

export const initialValue = {
  type: 'array',
  default: [] as ISnippet[],
} as const;

export const getModule = (store: Store<Record<string, unknown>>) => {
  const get = makeFnGetItemInStoredArray<ISnippet>(store, 'snippets');
  const add = makeFnAddItemInStoredArray<ISnippet>(store, 'snippets');
  const remove = makeFnRemoveStoredItemFromArray<ISnippet>(store, 'snippets');
  const edit = makeFnEditItemInStoredArray<ISnippet>(store, 'snippets');

  return { get, add, remove, edit };
};
