import crypto from 'crypto';
import type { Dialect, IConnectionConfig } from '@shared/types/connections';
import type { ProjectExportResult, ProjectTransferData } from '../../../types';
import { writeZipFile, type ZipFileEntry } from '../../../utils/zip';

const DBEAVER_DEFAULT_CREDENTIALS_KEY = Buffer.from(
  'babb4a9f774ab853c96c2d653dfe544a',
  'hex',
);

type DbeaverConnection = {
  provider: string;
  driver: string;
  name: string;
  configuration: Record<string, string | number>;
};

type DbeaverDataSources = {
  connections: Record<string, DbeaverConnection>;
};

type DbeaverCredentials = Record<string, {
  '#connection': {
    user?: string;
    password?: string;
  };
}>;

const SUPPORTED_DIALECTS = new Set<Dialect>(['postgres', 'mysql', 'sqlite']);

const DIALECT_DRIVER: Record<Exclude<Dialect, 'react-native-sqlite'>, string> = {
  postgres: 'postgresql',
  mysql: 'mysql',
  sqlite: 'sqlite',
};

const sanitizeZipSegment = (value: string) =>
  (value || 'General')
    .replace(/[\\/:*?"<>|]/g, '-')
    .replace(/\s+/g, ' ')
    .trim() || 'General';

const makeSqlFileName = (value: string) => {
  const name = sanitizeZipSegment(value || 'script');

  return /\.sql$/i.test(name) ? name : `${name}.sql`;
};

const makeUniqueZipPath = (path: string, usedPaths: Set<string>) => {
  if (!usedPaths.has(path)) {
    usedPaths.add(path);
    return path;
  }

  const extensionIndex = path.toLowerCase().lastIndexOf('.sql');
  const basePath = extensionIndex >= 0 ? path.slice(0, extensionIndex) : path;
  const extension = extensionIndex >= 0 ? path.slice(extensionIndex) : '';
  let index = 2;
  let nextPath = `${basePath}-${index}${extension}`;

  while (usedPaths.has(nextPath)) {
    index++;
    nextPath = `${basePath}-${index}${extension}`;
  }

  usedPaths.add(nextPath);
  return nextPath;
};

const makeJdbcUrl = (connection: IConnectionConfig) => {
  if (connection.dialect === 'sqlite') return `jdbc:sqlite:${connection.database}`;
  if (connection.dialect === 'postgres') {
    return `jdbc:postgresql://${connection.host}:${connection.port}/${connection.database}`;
  }

  return `jdbc:mysql://${connection.host}:${connection.port}/${connection.database}`;
};

const toDbeaverConnection = (connection: IConnectionConfig): DbeaverConnection => {
  const driver = DIALECT_DRIVER[connection.dialect as Exclude<Dialect, 'react-native-sqlite'>];
  const configuration: Record<string, string | number> = {
    url: makeJdbcUrl(connection),
    database: connection.database,
  };

  if (connection.dialect !== 'sqlite') {
    configuration.host = connection.host;
    configuration.port = connection.port;
  }

  return {
    provider: driver,
    driver,
    name: connection.description,
    configuration,
  };
};

const encryptDbeaverCredentials = (credentials: DbeaverCredentials) => {
  const iv = crypto.randomBytes(16);
  const cipher = crypto.createCipheriv('aes-128-cbc', DBEAVER_DEFAULT_CREDENTIALS_KEY, iv);
  const encrypted = Buffer.concat([
    cipher.update(JSON.stringify(credentials), 'utf8'),
    cipher.final(),
  ]);

  return Buffer.concat([iv, encrypted]);
};

export const exportDbeaverProjects = async (
  data: ProjectTransferData,
  path: string,
): Promise<ProjectExportResult> => {
    const entries: ZipFileEntry[] = [];
    const connectionsById = new Map(
      data.connections.map((connection) => [connection.id, connection] as const),
    );
    const connectionsByProject = new Map(
      data.projects.map((project) => [
        project.id,
        data.connections.filter((connection) => connection.id_project === project.id),
      ]),
    );
    const usedScriptPaths = new Set<string>();
    const unsupportedConnections: { name: string; dialect: string }[] = [];
    let connectionsExported = 0;
    let scriptsExported = 0;

    for (const project of data.projects) {
      const connections = connectionsByProject.get(project.id) || [];
      const dataSources: DbeaverDataSources = { connections: {} };
      const credentials: DbeaverCredentials = {};

      for (const connection of connections) {
        if (!SUPPORTED_DIALECTS.has(connection.dialect)) {
          unsupportedConnections.push({
            name: connection.description,
            dialect: connection.dialect,
          });
          continue;
        }

        dataSources.connections[connection.id] = toDbeaverConnection(connection);

        if (connection.username || connection.password) {
          credentials[connection.id] = {
            '#connection': {
              user: connection.username,
              password: connection.password,
            },
          };
        }

        connectionsExported++;
      }

      const projectPath = `${sanitizeZipSegment(project.description)}/.dbeaver`;
      entries.push({
        name: `${projectPath}/data-sources.json`,
        content: JSON.stringify(dataSources, null, 2),
      });

      if (Object.keys(credentials).length) {
        entries.push({
          name: `${projectPath}/credentials-config.json`,
          content: encryptDbeaverCredentials(credentials),
        });
      }

      for (const script of data.scripts ?? []) {
        const connection = connectionsById.get(script.id_connection);

        if (!connection || connection.id_project !== project.id) continue;

        const scriptPath = makeUniqueZipPath(
          [
            sanitizeZipSegment(project.description),
            'Scripts',
            sanitizeZipSegment(connection.description),
            makeSqlFileName(script.name),
          ].join('/'),
          usedScriptPaths,
        );

        entries.push({
          name: scriptPath,
          content: script.content,
        });
        scriptsExported++;
      }
    }

    await writeZipFile(path, entries);

    return {
      projectsExported: data.projects.length,
      connectionsExported,
      scriptsExported,
      unsupportedConnections,
    };
};
