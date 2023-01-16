import type Store from 'electron-store';
import {
  makeFnAddItemInStoredArray,
  makeFnEditItemInStoredArray,
  makeFnGetItemInStoredArray,
  makeFnRemoveStoredItemFromArray,
} from '../utils';

export interface IProject {
  id: string;
  description: string;
}

export const initialValue = {
  type: 'array',
  default: [] as IProject[],
} as const;

export const getModule = (store: Store<any>) => {
  const get = makeFnGetItemInStoredArray(store, 'projects');
  const add = makeFnAddItemInStoredArray(store, 'projects');
  const remove = makeFnRemoveStoredItemFromArray(store, 'projects');
  const edit = makeFnEditItemInStoredArray(store, 'projects');

  return { get, add, remove, edit };
};
