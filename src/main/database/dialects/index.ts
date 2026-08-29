import postgres from './postgres';
import mysql from './mysql';
import sqlite from './sqlite';
import type { DatabaseDialectAdapter } from '../types';

export type * from '../types';

export const dialectAdapters = {
  postgres,
  mysql,
  sqlite,
} satisfies Partial<Record<Dialect, DatabaseDialectAdapter>>;

export const getDialectIds = () => Object.keys(dialectAdapters) as Dialect[];

export const getDialectAdapter = (dialect: Dialect): DatabaseDialectAdapter => {
  const adapter = dialectAdapters[dialect];

  if (!adapter) throw new Error(`Dialeto não suportado: ${dialect}`);

  return adapter;
};
