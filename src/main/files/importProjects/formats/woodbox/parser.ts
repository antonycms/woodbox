import type { Dialect, IConnectionConfig } from '@shared/types/connections';
import type { IProject, IScript } from '@shared/types/workspace';
import type {
  ParsedProjectImportConnection,
  ProjectImportParseResult,
} from '../../../types';
import {
  decryptWoodboxFile,
  WOODBOX_TRANSFER_FORMAT,
  WOODBOX_TRANSFER_VERSION,
  type WoodboxTransferFile,
} from '../../../utils/woodboxEncryption';

const DIALECTS = new Set<Dialect>(['postgres', 'mysql', 'sqlite', 'react-native-sqlite']);

const isRecord = (value: unknown): value is Record<string, unknown> =>
  !!value && typeof value === 'object' && !Array.isArray(value);

const isProject = (value: unknown): value is IProject =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.description === 'string';

const isConnection = (value: unknown): value is IConnectionConfig =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.id_project === 'string' &&
  typeof value.description === 'string' &&
  typeof value.dialect === 'string' &&
  DIALECTS.has(value.dialect as Dialect) &&
  typeof value.database === 'string' &&
  typeof value.host === 'string' &&
  typeof value.port === 'number';

const isScript = (value: unknown): value is IScript =>
  isRecord(value) &&
  typeof value.id === 'string' &&
  typeof value.name === 'string' &&
  typeof value.id_connection === 'string' &&
  typeof value.content === 'string' &&
  typeof value.created_at === 'string' &&
  typeof value.updated_at === 'string';

const parseWoodboxTransferFile = (content: string): WoodboxTransferFile => {
  let data: unknown;

  try {
    data = JSON.parse(decryptWoodboxFile(content));
  } catch {
    throw new Error('Arquivo Woodbox inválido.');
  }

  if (
    !isRecord(data) ||
    data.format !== WOODBOX_TRANSFER_FORMAT ||
    data.version !== WOODBOX_TRANSFER_VERSION ||
    typeof data.exportedAt !== 'string' ||
    !Array.isArray(data.projects) ||
    !Array.isArray(data.connections)
  ) {
    throw new Error('Arquivo Woodbox incompatível.');
  }

  const projects = data.projects.filter(isProject);
  const connections = data.connections.filter(isConnection);
  const rawScripts = Array.isArray(data.scripts) ? data.scripts : [];
  const scripts = rawScripts.filter(isScript);

  if (
    projects.length !== data.projects.length ||
    connections.length !== data.connections.length ||
    scripts.length !== rawScripts.length
  ) {
    throw new Error('Arquivo Woodbox contém projetos, conexões ou scripts inválidos.');
  }

  return {
    format: WOODBOX_TRANSFER_FORMAT,
    version: WOODBOX_TRANSFER_VERSION,
    exportedAt: data.exportedAt,
    projects,
    connections,
    scripts,
  };
};

const toParsedConnection = (connection: IConnectionConfig): ParsedProjectImportConnection => {
  const { id, id_project: _idProject, ...data } = connection;

  return {
    ...data,
    sourceId: id,
    sourceDriver: connection.dialect,
  };
};

const makeImportResult = (data: WoodboxTransferFile): ProjectImportParseResult => {
  const credentialsImported = data.connections.filter(
    (connection) => connection.username || connection.password,
  ).length;

  return {
    projects: data.projects.map((project) => ({
      sourceName: project.id,
      description: project.description,
      connections: data.connections
        .filter((connection) => connection.id_project === project.id)
        .map(toParsedConnection),
    })).filter((project) => project.connections.length),
    unsupportedConnections: [],
    credentialsFiles: 0,
    credentialsImported,
    credentialsMissing: data.connections.length - credentialsImported,
    requiresMasterPassword: false,
    warnings: [],
    scripts: (data.scripts ?? []).map((script) => ({
      sourceId: script.id,
      sourceConnectionId: script.id_connection,
      name: script.name,
      content: script.content,
      created_at: script.created_at,
      updated_at: script.updated_at,
    })),
  };
};

export const parseWoodboxExport = (content: string): ProjectImportParseResult =>
  makeImportResult(parseWoodboxTransferFile(content));
