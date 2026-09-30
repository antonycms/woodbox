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
    const connectionsByProject = new Map(
      data.projects.map((project) => [
        project.id,
        data.connections.filter((connection) => connection.id_project === project.id),
      ]),
    );
    const unsupportedConnections: { name: string; dialect: string }[] = [];
    let connectionsExported = 0;

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
    }

    await writeZipFile(path, entries);

    return {
      projectsExported: data.projects.length,
      connectionsExported,
      unsupportedConnections,
    };
};
