import type Store from 'electron-store';
import {
  makeFnAddItemInStoredArray,
  makeFnRemoveStoredItemFromArray,
  makeFnGetItemInStoredArray,
  makeFnEditItemInStoredArray,
} from '../utils';

export const initialValue = {
  type: 'array',
  default: [] as Dialect[],
} as const;

export const getModule = (store: Store<any>) => {
  const get = makeFnGetItemInStoredArray(store, 'dialects');
  const add = makeFnAddItemInStoredArray(store, 'dialects');
  const remove = makeFnRemoveStoredItemFromArray(store, 'dialects');
  const edit = makeFnEditItemInStoredArray(store, 'dialects');

  return { get, add, remove, edit };
};
