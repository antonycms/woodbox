import type { WoodboxApi } from '@shared/types/api';
import type { IProject, IProjectCreate, IScriptMetadata } from '@shared/types/workspace';
import type { IConnectionPublic, IConnectionCreateInput } from '@shared/types/connections';
import type { IDatabaseDialectInfo, IConnectionInfo, IConnectionDialectDescriptor, IDatabaseTechnicalCapabilities, DatabaseStructureOptions } from '@shared/types/database';

export type DialectCatalogState =
  | { status: 'idle' }
  | { status: 'loading' }
  | { status: 'ready'; items: IDatabaseDialectInfo[] }
  | { status: 'error' };

export interface ConnectionPresentation {
  dialect: IConnectionPublic['dialect'];
  structure?: DatabaseStructureOptions;
  mode?: IConnectionDialectDescriptor['mode'];
  capabilities?: IDatabaseTechnicalCapabilities;
}

export interface IWorkspaceStore {
  initialize(): Promise<void>;
  refresh(): Promise<void>;
  loadDialectCatalog(): Promise<void>;
  
  projects: IProject[];
  addProject(data: IProjectCreate): Promise<IProject>;
  editProject(id: string, data: IProjectCreate): Promise<void>;
  removeProject: WoodboxApi['projects']['remove'];
  exportProjects: WoodboxApi['projects']['export'];

  scripts: IScriptMetadata[];
  addScript(data: Omit<IScriptMetadata, 'id'>): Promise<IScriptMetadata>;
  editScript: WoodboxApi['scripts']['edit'];
  removeScript: WoodboxApi['scripts']['remove'];
  getScriptContent: WoodboxApi['scripts']['getContent'];

  connections: IConnectionPublic[];
  connectionTypes: string[];
  dialectCatalog: DialectCatalogState;
  connectionsInfo: Map<string, IConnectionInfo>;
  addConnection(data: IConnectionCreateInput): Promise<void>;
  editConnection: WoodboxApi['connections']['edit'];
  removeConnection: WoodboxApi['connections']['remove'];
  testConnection: WoodboxApi['connections']['test'];
  loadConnectionInfo(id: string, force?: boolean): Promise<void>;
  reloadConnectionInfo(id: string, force?: boolean): Promise<void>;
  closeConnection: WoodboxApi['connections']['close'];
  importConnectionsFromSource: WoodboxApi['connections']['import'];
  previewImportConnectionsFromSource: WoodboxApi['connections']['previewImport'];
}

export interface IConnectionsGroupPerProject extends IProject {
  connections: IConnectionPublic[];
}

