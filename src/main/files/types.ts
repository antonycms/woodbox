import type { IConnectionConfig } from '@shared/types/connections';
import type {
  IImportConnectionsParams,
  ProjectExportFormat,
  ProjectImportFormat,
} from '@shared/types/imports';
import type { IProject } from '@shared/types/workspace';

export type ParsedProjectImportConnection = Omit<IConnectionConfig, 'id' | 'id_project'> & {
  sourceId: string;
  sourceDriver?: string;
};

export type ParsedProjectImportProject = {
  sourceName: string;
  description: string;
  connections: ParsedProjectImportConnection[];
};

export type ProjectImportParseResult = {
  projects: ParsedProjectImportProject[];
  unsupportedConnections: { name: string; driver?: string }[];
  credentialsFiles: number;
  credentialsImported: number;
  credentialsMissing: number;
  requiresMasterPassword: boolean;
  warnings: string[];
};

export type ProjectTransferData = {
  projects: IProject[];
  connections: IConnectionConfig[];
};

export type ProjectExportResult = {
  projectsExported: number;
  connectionsExported: number;
  unsupportedConnections: { name: string; dialect: string }[];
};

export type ProjectImportAdapter = {
  format: ProjectImportFormat;
  name: string;
  extensions: string[];
  parse(path: string, options: Pick<IImportConnectionsParams, 'masterPassword'>): Promise<ProjectImportParseResult>;
};

export type ProjectExportAdapter = {
  format: ProjectExportFormat;
  name: string;
  extensions: string[];
  defaultExtension: string;
  export(data: ProjectTransferData, path: string): Promise<ProjectExportResult>;
};
