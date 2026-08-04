import Store from 'electron-store';
import { initialValue as projects, getModule as getModuleProjects } from './modules/projects';
import {
  initialValue as saved_connections,
  getModule as getModuleSavedConnections,
} from './modules/saved_connections';
import { initialValue as scripts_meta, getModule as getModuleScripts } from './modules/scripts';
import { initialValue as snippets, getModule as getModuleSnippets } from './modules/snippets';
import {
  parseDbeaverExport,
  toStoredDbeaverConnection,
  toStoredDbeaverProject,
} from '@main/files/importers/dbeaver';

type WindowState = { width: number; height: number; x: number; y: number; isMaximized: boolean };

const store = new Store<Record<string, unknown>>({
  schema: {
    projects,
    saved_connections,
    scripts_meta,
    snippets,
    window_state: {
      type: ['object', 'null'],
      default: null,
    },
  },
});

export const getWindowState = (): WindowState | null =>
  (store.get('window_state') as WindowState | null) ?? null;

export const saveWindowState = (state: WindowState): void => {
  store.set('window_state', state);
};

export const {
  add: addProject,
  get: getProjects,
  remove: removeProject,
  edit: editProject,
} = getModuleProjects(store);

export const {
  add: addConnectionSaved,
  get: getConnectionsSaved,
  remove: removeConnectionSaved,
  edit: editConnectionSaved,
} = getModuleSavedConnections(store);

export const {
  add: addScript,
  remove: removeScript,
  getMeta: getScriptsMeta,
  getContent: getScriptContent,
  patch: patchScript,
} = getModuleScripts(store);

export const {
  add: addSnippet,
  get: getSnippets,
  remove: removeSnippet,
  edit: editSnippet,
} = getModuleSnippets(store);

const getStoredProjects = () => (store.get('projects') as IProject[] | undefined) ?? [];
const getStoredConnections = () =>
  (store.get('saved_connections') as IConnectionConfig[] | undefined) ?? [];

const normalizeText = (value?: string) => value?.trim?.().toLowerCase?.() || '';

const isSameConnection = (a: IConnectionConfig, b: IConnectionConfig) =>
  a.id_project === b.id_project &&
  a.dialect === b.dialect &&
  normalizeText(a.description) === normalizeText(b.description) &&
  normalizeText(a.host) === normalizeText(b.host) &&
  normalizeText(a.database) === normalizeText(b.database) &&
  Number(a.port || 0) === Number(b.port || 0);

const makeSelectionKey = (sourceName: string, sourceId: string) => `${sourceName}:${sourceId}`;

const getSelectionKeys = (selection?: IImportConnectionsSelection) => {
  if (!selection) return null;

  return new Set(
    selection.projects.flatMap((project) =>
      project.connections.map((connectionId) => makeSelectionKey(project.sourceName, connectionId)),
    ),
  );
};

const assertSupportedImportSource = (source: ImportConnectionsSource) => {
  if (source !== 'dbeaver') {
    throw new Error(`Origem de importação não suportada: ${source}`);
  }
};

export const previewImportConnectionsFromSource = async ({
  source,
  path,
  masterPassword,
}: IImportConnectionsParams): Promise<IImportConnectionsPreview> => {
  assertSupportedImportSource(source);

  const parsed = await parseDbeaverExport(path, { masterPassword });
  const projects = getStoredProjects();
  const connections = getStoredConnections();

  return {
    path,
    projects: parsed.projects.map((parsedProject) => {
      const project = projects.find(
        (item) => normalizeText(item.description) === normalizeText(parsedProject.description),
      );

      return {
        sourceName: parsedProject.sourceName,
        description: parsedProject.description,
        connections: parsedProject.connections.map((parsedConnection) => {
          const connection = toStoredDbeaverConnection(parsedConnection, project?.id || '');

          return {
            sourceId: parsedConnection.sourceId,
            description: parsedConnection.description,
            dialect: parsedConnection.dialect,
            host: parsedConnection.host,
            port: parsedConnection.port,
            database: parsedConnection.database,
            username: parsedConnection.username,
            hasPassword: !!parsedConnection.password,
            alreadyExists: project
              ? connections.some((item) => isSameConnection(item, connection))
              : false,
          };
        }),
      };
    }),
    unsupportedConnections: parsed.unsupportedConnections,
    credentialsFiles: parsed.credentialsFiles,
    credentialsImported: parsed.credentialsImported,
    credentialsMissing: parsed.credentialsMissing,
    requiresMasterPassword: parsed.requiresMasterPassword,
    warnings: parsed.warnings,
  };
};

export const importConnectionsFromSource = async ({
  source,
  path,
  masterPassword,
  selection,
}: IImportConnectionsParams): Promise<IImportConnectionsResult> => {
  assertSupportedImportSource(source);

  const parsed = await parseDbeaverExport(path, { masterPassword });
  const selectionKeys = getSelectionKeys(selection);
  const projects = getStoredProjects();
  const connections = getStoredConnections();
  const nextProjects = [...projects];
  const nextConnections = [...connections];
  let projectsCreated = 0;
  let projectsReused = 0;
  let connectionsImported = 0;
  let connectionsSkipped = 0;
  let credentialsImported = 0;
  let credentialsMissing = 0;

  for (const parsedProject of parsed.projects) {
    const selectedConnections = parsedProject.connections.filter(
      (connection) =>
        !selectionKeys ||
        selectionKeys.has(makeSelectionKey(parsedProject.sourceName, connection.sourceId)),
    );

    if (!selectedConnections.length) continue;

    let project = nextProjects.find(
      (item) => normalizeText(item.description) === normalizeText(parsedProject.description),
    );

    if (project) {
      projectsReused++;
    } else {
      project = toStoredDbeaverProject(parsedProject.description);
      nextProjects.push(project);
      projectsCreated++;
    }

    for (const parsedConnection of selectedConnections) {
      const connection = toStoredDbeaverConnection(parsedConnection, project.id);

      if (nextConnections.some((item) => isSameConnection(item, connection))) {
        connectionsSkipped++;
        continue;
      }

      if (connection.username || connection.password) {
        credentialsImported++;
      } else {
        credentialsMissing++;
      }

      nextConnections.push(connection);
      connectionsImported++;
    }
  }

  store.set('projects', nextProjects);
  store.set('saved_connections', nextConnections);

  return {
    projectsCreated,
    projectsReused,
    connectionsImported,
    connectionsSkipped,
    unsupportedConnections: parsed.unsupportedConnections,
    credentialsFiles: parsed.credentialsFiles,
    credentialsImported,
    credentialsMissing,
    warnings: parsed.warnings,
  };
};
