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

  export type ImportConnectionsSource = 'dbeaver';

  export interface IImportConnectionsSelection {
    projects: { sourceName: string; connections: string[] }[];
  }

  export interface IImportConnectionsParams {
    source: ImportConnectionsSource;
    path: string;
    masterPassword?: string;
    selection?: IImportConnectionsSelection;
  }

  export interface IImportConnectionsPreviewConnection {
    sourceId: string;
    description: string;
    dialect: Dialect;
    host: string;
    port: number;
    database: string;
    username?: string;
    hasPassword: boolean;
    alreadyExists: boolean;
  }

  export interface IImportConnectionsPreviewProject {
    sourceName: string;
    description: string;
    connections: IImportConnectionsPreviewConnection[];
  }

  export interface IImportConnectionsPreview {
    path: string;
    projects: IImportConnectionsPreviewProject[];
    unsupportedConnections: { name: string; driver?: string }[];
    credentialsFiles: number;
    credentialsImported: number;
    credentialsMissing: number;
    requiresMasterPassword: boolean;
    warnings: string[];
  }

  export interface IImportConnectionsResult {
    projectsCreated: number;
    projectsReused: number;
    connectionsImported: number;
    connectionsSkipped: number;
    unsupportedConnections: { name: string; driver?: string }[];
    credentialsFiles: number;
    credentialsImported: number;
    credentialsMissing: number;
    warnings: string[];
  }
}
