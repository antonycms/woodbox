import type { Knex } from 'knex';

declare global {
  export type Dialect = 'postgres';

  export interface IConnectionConfig {
    id: string;
    id_project: string;
    description: string;
    dialect: Dialect;
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
}
