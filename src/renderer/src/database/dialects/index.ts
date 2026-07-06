import postgres from './postgres';
import mysql from './mysql';
import sqlite from './sqlite';
import type { Dialect, RendererDialect } from './types';

export type * from './types';

export const rendererDialects: Record<Dialect, RendererDialect> = {
  postgres,
  mysql,
  sqlite,
};

export const getRendererDialect = (dialect?: string): RendererDialect => {
  return rendererDialects[(dialect || 'postgres') as Dialect] || rendererDialects.postgres;
};

export const getRendererDialectOptions = (dialects: string[] = []) => {
  return dialects.map((dialect) => getRendererDialect(dialect));
};
