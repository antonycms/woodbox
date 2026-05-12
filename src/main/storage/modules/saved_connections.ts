import type Store from 'electron-store';
import {
  makeFnAddItemInStoredArray,
  makeFnEditItemInStoredArray,
  makeFnGetItemInStoredArray,
  makeFnRemoveStoredItemFromArray,
} from '../utils';

export interface IConnectionConfig {
  id: string;
  id_project: string;
  description: string;
  dialect: string;
  database: string;
  host: string;
  port: number;
  username?: string;
  password?: string;
}

export const initialValue = {
  type: 'array',
  default: [] as IConnectionConfig[],
} as const;

export const getModule = (store: Store<any>) => {
  const get = makeFnGetItemInStoredArray(store, 'saved_connections');
  const add = makeFnAddItemInStoredArray(store, 'saved_connections');
  const remove = makeFnRemoveStoredItemFromArray(store, 'saved_connections');
  const edit = makeFnEditItemInStoredArray(store, 'saved_connections');

  return { get, add, remove, edit };
};
