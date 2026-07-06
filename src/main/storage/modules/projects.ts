import type Store from 'electron-store';
import {
  makeFnAddItemInStoredArray,
  makeFnEditItemInStoredArray,
  makeFnGetItemInStoredArray,
  makeFnRemoveStoredItemFromArray,
} from '@main/storage/utils';

export const initialValue = {
  type: 'array',
  default: [] as IProject[],
} as const;

export const getModule = (store: Store<Record<string, unknown>>) => {
  const get = makeFnGetItemInStoredArray<IProject>(store, 'projects');
  const add = makeFnAddItemInStoredArray<IProject>(store, 'projects');
  const remove = makeFnRemoveStoredItemFromArray<IProject>(store, 'projects');
  const edit = makeFnEditItemInStoredArray<IProject>(store, 'projects');

  return { get, add, remove, edit };
};
