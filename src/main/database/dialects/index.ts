import type { Dialect } from '@shared/types/connections';
import type { IDatabaseTechnicalCapabilities } from '@shared/types/database';
import postgres from './postgres';
import mysql from './mysql';
import sqlite from './sqlite';
import reactNativeSqlite from './reactNativeSqlite';
import type { DatabaseDialectAdapter } from '../types';

export type * from '../types';

export const dialectAdapters = {
  postgres,
  mysql,
  sqlite,
  'react-native-sqlite': reactNativeSqlite,
} satisfies Partial<Record<Dialect, DatabaseDialectAdapter>>;

export const getDialectIds = () => Object.keys(dialectAdapters) as Dialect[];

export const getDialectAdapter = (dialect: Dialect): DatabaseDialectAdapter => {
  const adapter = dialectAdapters[dialect];

  if (!adapter) throw new Error(`Dialeto não suportado: ${dialect}`);

  return adapter;
};

export const getDialectCapabilities = (adapter: DatabaseDialectAdapter): IDatabaseTechnicalCapabilities => ({
  supports_schemas: Boolean(adapter.queries.getAllSchemas),
  supports_functions: Boolean(adapter.queries.getFunctions),
  supports_process_list: Boolean(adapter.queries.getProcessList),
});
