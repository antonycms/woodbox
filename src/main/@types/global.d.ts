import type { Knex } from 'knex';

declare global {
  export type Dialect = 'postgres' | 'mysql' | 'sqlite';
  export type ConnectionEnvironment = 'development' | 'production';

  export interface IConnectionConfig {
    id: string;
    id_project: string;
    description: string;
    dialect: Dialect;
    environment?: ConnectionEnvironment;
    database: string;
    host: string;
    port: number;
    username?: string;
    password?: string;
  }

  export interface IConnection {
    id: string;
    instance: Knex<any, unknown[]>;
    dialect: Dialect;
  }

  export interface IScript {
    id: string;
    name: string;
    id_connection: string;
    content: string;
    created_at: string;
    updated_at: string;
  }

  export interface IProject {
    id: string;
    description: string;
  }
}
