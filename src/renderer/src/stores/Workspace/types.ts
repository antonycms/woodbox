import type { WoodboxApi } from '@shared/types/api';
import type { IProject, IProjectCreate, IScriptMetadata } from '@shared/types/workspace';
import type { IConnectionPublic, IConnectionCreate } from '@shared/types/connections';
import type { IConnectionInfo } from '@shared/types/database';

export interface IWorkspaceStore {
  initialize(): Promise<void>;
  refresh(): Promise<void>;
  
  projects: IProject[];
  addProject(data: IProjectCreate): Promise<void>;
  editProject(id: string, data: IProjectCreate): Promise<void>;
  removeProject: WoodboxApi['projects']['remove'];

  scripts: IScriptMetadata[];
  addScript(data: Omit<IScriptMetadata, 'id'>): Promise<IScriptMetadata>;
  editScript: WoodboxApi['scripts']['edit'];
  removeScript: WoodboxApi['scripts']['remove'];
  getScriptContent: WoodboxApi['scripts']['getContent'];

  connections: IConnectionPublic[];
  connectionTypes: string[];
  connectionsInfo: Map<string, IConnectionInfo>;
  addConnection(data: IConnectionCreate): Promise<void>;
  editConnection: WoodboxApi['connections']['edit'];
  removeConnection: WoodboxApi['connections']['remove'];
  testConnection: WoodboxApi['connections']['test'];
  loadConnectionInfo(id: string): Promise<void>;
  reloadConnectionInfo(id: string): Promise<void>;
  closeConnection: WoodboxApi['connections']['close'];
  importConnectionsFromSource: WoodboxApi['connections']['import'];
  previewImportConnectionsFromSource: WoodboxApi['connections']['previewImport'];
}

export interface IConnectionsGroupPerProject extends IProject {
  connections: IConnectionPublic[];
}

