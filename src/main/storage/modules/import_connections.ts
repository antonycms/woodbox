import type { IConnectionConfig } from '@shared/types/connections';
import type {
  ImportConnectionsSource,
  IImportConnectionsSelection,
  IImportConnectionsParams,
  IImportConnectionsPreview,
  IImportConnectionsResult,
} from '@shared/types/imports';
import type { IProject } from '@shared/types/workspace';
import type Store from 'electron-store';
import {
  parseDbeaverExport,
  toStoredDbeaverConnection,
  toStoredDbeaverProject,
} from '../../files/importers/dbeaver';
import { encodeConnectionSecretsForStore } from './saved_connections';

type AppStore = Store<Record<string, unknown>>;

const getStoredProjects = (store: AppStore) =>
  (store.get('projects') as IProject[] | undefined) ?? [];

const getStoredConnections = (store: AppStore) =>
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

export const getModule = (store: AppStore) => {
  const preview = async ({
    source,
    path,
    masterPassword,
  }: IImportConnectionsParams): Promise<IImportConnectionsPreview> => {
    assertSupportedImportSource(source);

    const parsed = await parseDbeaverExport(path, { masterPassword });
    const projects = getStoredProjects(store);
    const connections = getStoredConnections(store);

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

  const execute = async ({
    source,
    path,
    masterPassword,
    selection,
  }: IImportConnectionsParams): Promise<IImportConnectionsResult> => {
    assertSupportedImportSource(source);

    const parsed = await parseDbeaverExport(path, { masterPassword });
    const selectionKeys = getSelectionKeys(selection);
    const projects = getStoredProjects(store);
    const connections = getStoredConnections(store);
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
    store.set(
      'saved_connections',
      nextConnections.map((connection) => encodeConnectionSecretsForStore(store, connection)),
    );

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

  return { preview, execute };
};
