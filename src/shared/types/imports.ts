import type { Dialect } from './connections';

export type ImportConnectionsSource = 'dbeaver' | 'woodbox';
export type ProjectImportFormat = ImportConnectionsSource;
export type ProjectExportFormat = 'dbeaver' | 'woodbox';

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

export interface IExportProjectsParams {
  format: ProjectExportFormat;
  path: string;
  selection?: {
    projects: { id: string; connections: string[] }[];
  };
}

export interface IExportProjectsResult {
  projectsExported: number;
  connectionsExported: number;
  scriptsExported: number;
  unsupportedConnections: { name: string; dialect: string }[];
}
