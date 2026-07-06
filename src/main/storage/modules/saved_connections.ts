import type Store from 'electron-store';
import {
  makeFnAddItemInStoredArray,
  makeFnEditItemInStoredArray,
  makeFnGetItemInStoredArray,
  makeFnRemoveStoredItemFromArray,
} from '../utils';

export const initialValue = {
  type: 'array',
  default: [] as IConnectionConfig[],
} as const;

export const getModule = (store: Store<Record<string, unknown>>) => {
  const get = makeFnGetItemInStoredArray<IConnectionConfig>(store, 'saved_connections');
  const add = makeFnAddItemInStoredArray<IConnectionConfig>(store, 'saved_connections');
  const remove = makeFnRemoveStoredItemFromArray<IConnectionConfig>(store, 'saved_connections');
  const edit = makeFnEditItemInStoredArray<IConnectionConfig>(store, 'saved_connections');

  return { get, add, remove, edit };
};
