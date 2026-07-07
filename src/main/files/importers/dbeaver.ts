import crypto from 'crypto';
import fs from 'fs/promises';
import zlib from 'zlib';
import { promisify } from 'util';
import { generateHash } from '@main/utils/methods';

const inflateRaw = promisify(zlib.inflateRaw);

const DBEAVER_DEFAULT_CREDENTIALS_KEY = Buffer.from('babb4a9f774ab853c96c2d653dfe544a', 'hex');
const DBEAVER_DEFAULT_CREDENTIALS_IV = Buffer.alloc(16);

type ZipEntry = {
  name: string;
  compressionMethod: number;
  compressedSize: number;
  uncompressedSize: number;
  localHeaderOffset: number;
};

type DbeaverDataSources = {
  connections?: Record<string, DbeaverConnection>;
};

type DbeaverConnection = {
  name?: string;
  driver?: string;
  provider?: string;
  folder?: string;
  configuration?: Record<string, unknown>;
  [key: string]: unknown;
};

type DbeaverCredential = {
  '#connection'?: {
    user?: string;
    password?: string;
  };
  user?: string;
  password?: string;
};

type DbeaverCredentials = Record<string, DbeaverCredential>;

export type ParsedDbeaverProject = {
  sourceName: string;
  description: string;
  connections: ParsedDbeaverConnection[];
};

export type ParsedDbeaverConnection = Omit<IConnectionConfig, 'id' | 'id_project'> & {
  sourceId: string;
  sourceDriver?: string;
};

export type DbeaverImportParseResult = {
  projects: ParsedDbeaverProject[];
  unsupportedConnections: { name: string; driver?: string }[];
  credentialsFiles: number;
  credentialsImported: number;
  credentialsMissing: number;
  requiresMasterPassword: boolean;
  warnings: string[];
};

export type DbeaverImportOptions = {
  masterPassword?: string;
};

const normalizeZipPath = (value: string) => value.replace(/\\/g, '/');

const readUInt64LEAsNumber = (buffer: Buffer, offset: number) => {
  const value = buffer.readBigUInt64LE(offset);

  if (value > BigInt(Number.MAX_SAFE_INTEGER)) {
    throw new Error('Arquivo ZIP grande demais para importar.');
  }

  return Number(value);
};

const findEndOfCentralDirectory = (buffer: Buffer) => {
  const signature = 0x06054b50;
  const minOffset = Math.max(0, buffer.length - 0xffff - 22);

  for (let offset = buffer.length - 22; offset >= minOffset; offset--) {
    if (buffer.readUInt32LE(offset) === signature) return offset;
  }

  throw new Error('ZIP inválido: diretório central não encontrado.');
};

const readZipEntries = (buffer: Buffer): ZipEntry[] => {
  const eocdOffset = findEndOfCentralDirectory(buffer);
  let entriesCount = buffer.readUInt16LE(eocdOffset + 10);
  let centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (entriesCount === 0xffff || centralDirectoryOffset === 0xffffffff) {
    const zip64LocatorOffset = eocdOffset - 20;

    if (zip64LocatorOffset < 0 || buffer.readUInt32LE(zip64LocatorOffset) !== 0x07064b50) {
      throw new Error('ZIP64 não suportado neste export.');
    }

    const zip64EocdOffset = readUInt64LEAsNumber(buffer, zip64LocatorOffset + 8);

    if (buffer.readUInt32LE(zip64EocdOffset) !== 0x06064b50) {
      throw new Error('ZIP64 inválido: diretório central não encontrado.');
    }

    entriesCount = readUInt64LEAsNumber(buffer, zip64EocdOffset + 32);
    centralDirectoryOffset = readUInt64LEAsNumber(buffer, zip64EocdOffset + 48);
  }

  const entries: ZipEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < entriesCount; index++) {
    if (buffer.readUInt32LE(offset) !== 0x02014b50) {
      throw new Error('ZIP inválido: entrada do diretório central corrompida.');
    }

    const compressionMethod = buffer.readUInt16LE(offset + 10);
    const compressedSize = buffer.readUInt32LE(offset + 20);
    const uncompressedSize = buffer.readUInt32LE(offset + 24);
    const fileNameLength = buffer.readUInt16LE(offset + 28);
    const extraFieldLength = buffer.readUInt16LE(offset + 30);
    const fileCommentLength = buffer.readUInt16LE(offset + 32);
    const localHeaderOffset = buffer.readUInt32LE(offset + 42);
    const name = normalizeZipPath(
      buffer.toString('utf8', offset + 46, offset + 46 + fileNameLength),
    );

    entries.push({ name, compressionMethod, compressedSize, uncompressedSize, localHeaderOffset });

    offset += 46 + fileNameLength + extraFieldLength + fileCommentLength;
  }

  return entries;
};

const readZipEntryContent = async (zipBuffer: Buffer, entry: ZipEntry) => {
  const headerOffset = entry.localHeaderOffset;

  if (zipBuffer.readUInt32LE(headerOffset) !== 0x04034b50) {
    throw new Error(`ZIP inválido: cabeçalho local corrompido em ${entry.name}.`);
  }

  const fileNameLength = zipBuffer.readUInt16LE(headerOffset + 26);
  const extraFieldLength = zipBuffer.readUInt16LE(headerOffset + 28);
  const dataOffset = headerOffset + 30 + fileNameLength + extraFieldLength;
  const compressed = zipBuffer.subarray(dataOffset, dataOffset + entry.compressedSize);

  if (entry.compressionMethod === 0) return compressed;
  if (entry.compressionMethod === 8) return await inflateRaw(compressed);

  throw new Error(`Método de compressão não suportado em ${entry.name}.`);
};

const getProjectNameFromDataSourcesPath = (path: string) => {
  const parts = path.split('/').filter(Boolean);
  const dbeaverIndex = parts.lastIndexOf('.dbeaver');

  if (dbeaverIndex > 0) return parts[dbeaverIndex - 1];

  return 'General';
};

const getDirectoryPath = (path: string) => path.split('/').slice(0, -1).join('/');

const parseJson = <T>(content: Buffer, path: string): T => {
  try {
    return JSON.parse(content.toString('utf8')) as T;
  } catch {
    throw new Error(`Arquivo JSON inválido no export do DBeaver: ${path}`);
  }
};

const decryptDbeaverCredentials = (content: Buffer, _options: DbeaverImportOptions) => {
  const decipher = crypto.createDecipheriv(
    'aes-128-cbc',
    DBEAVER_DEFAULT_CREDENTIALS_KEY,
    DBEAVER_DEFAULT_CREDENTIALS_IV,
  );

  const decrypted = Buffer.concat([decipher.update(content), decipher.final()]);
  const json = decrypted.subarray(16).toString('utf8').trim();

  return JSON.parse(json) as DbeaverCredentials;
};

const getString = (...values: unknown[]) => {
  const value = values.find((item) => typeof item === 'string' && item.trim());
  return typeof value === 'string' ? value.trim() : '';
};

const getNumber = (...values: unknown[]) => {
  for (const value of values) {
    if (typeof value === 'number' && Number.isFinite(value)) return value;

    if (typeof value === 'string' && value.trim()) {
      const parsed = Number(value);
      if (Number.isFinite(parsed)) return parsed;
    }
  }

  return 0;
};

const parseJdbcUrl = (
  dialect: Dialect,
  value: string,
): Partial<Pick<IConnectionConfig, 'host' | 'port' | 'database'>> => {
  if (!value) return {};

  if (dialect === 'sqlite') {
    return { database: value.replace(/^jdbc:sqlite:/i, '') };
  }

  const normalized = value
    .replace(/^jdbc:postgresql:/i, 'postgresql:')
    .replace(/^jdbc:mysql:/i, 'mysql:')
    .replace(/^jdbc:mariadb:/i, 'mysql:');

  try {
    const url = new URL(normalized);

    return {
      host: url.hostname,
      port: url.port ? Number(url.port) : 0,
      database: url.pathname.replace(/^\//, ''),
    };
  } catch {
    return {};
  }
};

const getDialect = (connection: DbeaverConnection): Dialect | null => {
  const driver = getString(connection.driver, connection.provider).toLowerCase();

  if (driver.includes('postgres')) return 'postgres';
  if (driver.includes('mysql') || driver.includes('maria')) return 'mysql';
  if (driver.includes('sqlite')) return 'sqlite';

  return null;
};

const getCredential = (credentials: DbeaverCredentials | undefined, id: string) => {
  const credential = credentials?.[id];

  return {
    username: getString(credential?.['#connection']?.user, credential?.user),
    password: getString(credential?.['#connection']?.password, credential?.password),
  };
};

const parseConnection = (
  id: string,
  connection: DbeaverConnection,
  credentials: DbeaverCredentials | undefined,
): ParsedDbeaverConnection | null => {
  const dialect = getDialect(connection);

  if (!dialect) return null;

  const configuration = connection.configuration || {};
  const jdbcUrl = getString(configuration.url, connection.url);
  const jdbcData = parseJdbcUrl(dialect, jdbcUrl);
  const credential = getCredential(credentials, id);
  const description = getString(connection.name, id);
  const host =
    dialect === 'sqlite' ? '' : getString(configuration.host, connection.host, jdbcData.host);
  const database = getString(
    configuration.database,
    configuration['databaseName'],
    configuration['database-name'],
    connection.database,
    jdbcData.database,
  );
  const port =
    dialect === 'sqlite' ? 0 : getNumber(configuration.port, connection.port, jdbcData.port);

  return {
    sourceId: id,
    sourceDriver: getString(connection.driver, connection.provider),
    description,
    dialect,
    environment: 'development',
    database,
    host,
    port,
    username: credential.username || undefined,
    password: credential.password || undefined,
  };
};

export const parseDbeaverExport = async (
  zipPath: string,
  options: DbeaverImportOptions = {},
): Promise<DbeaverImportParseResult> => {
  const zipBuffer = await fs.readFile(zipPath);
  const entries = readZipEntries(zipBuffer).filter((entry) => !entry.name.endsWith('/'));
  const entriesByName = new Map(entries.map((entry) => [entry.name, entry]));
  const dataSourcesEntries = entries.filter((entry) =>
    /(^|\/)\.dbeaver\/data-sources.*\.json$/i.test(entry.name),
  );

  if (!dataSourcesEntries.length) {
    throw new Error('Nenhum data-sources.json do DBeaver foi encontrado no ZIP.');
  }

  const projects = new Map<string, ParsedDbeaverProject>();
  const unsupportedConnections: { name: string; driver?: string }[] = [];
  const credentialsCache = new Map<string, DbeaverCredentials>();
  const warnings: string[] = [];
  let credentialsFiles = 0;
  let credentialsImported = 0;
  let credentialsMissing = 0;
  let requiresMasterPassword = false;

  for (const dataSourcesEntry of dataSourcesEntries) {
    const directory = getDirectoryPath(dataSourcesEntry.name);
    const credentialsEntry = entriesByName.get(`${directory}/credentials-config.json`);
    let credentials: DbeaverCredentials | undefined;

    if (credentialsEntry) {
      credentialsFiles++;

      try {
        const credentialsContent = await readZipEntryContent(zipBuffer, credentialsEntry);
        credentials = decryptDbeaverCredentials(credentialsContent, options);
        credentialsCache.set(directory, credentials);
      } catch {
        requiresMasterPassword = true;
        warnings.push(
          options.masterPassword
            ? `Não foi possível ler credenciais protegidas em ${credentialsEntry.name}.`
            : `Credenciais protegidas em ${credentialsEntry.name}; informe a senha mestra se houver.`,
        );
      }
    } else {
      warnings.push(`Credenciais não encontradas em ${directory}/credentials-config.json.`);
    }

    credentials = credentials || credentialsCache.get(directory);

    const content = await readZipEntryContent(zipBuffer, dataSourcesEntry);
    const dataSources = parseJson<DbeaverDataSources>(content, dataSourcesEntry.name);
    const projectName = getProjectNameFromDataSourcesPath(dataSourcesEntry.name);
    const project = projects.get(projectName) || {
      sourceName: projectName,
      description: projectName,
      connections: [],
    };

    for (const [id, connection] of Object.entries(dataSources.connections || {})) {
      const parsedConnection = parseConnection(id, connection, credentials);

      if (!parsedConnection) {
        unsupportedConnections.push({
          name: getString(connection.name, id),
          driver: getString(connection.driver, connection.provider),
        });
        continue;
      }

      if (parsedConnection.username || parsedConnection.password) {
        credentialsImported++;
      } else {
        credentialsMissing++;
      }

      project.connections.push(parsedConnection);
    }

    projects.set(projectName, project);
  }

  return {
    projects: [...projects.values()].filter((project) => project.connections.length),
    unsupportedConnections,
    credentialsFiles,
    credentialsImported,
    credentialsMissing,
    requiresMasterPassword,
    warnings,
  };
};

export const toStoredDbeaverProject = (description: string): IProject => ({
  id: generateHash(),
  description,
});

export const toStoredDbeaverConnection = (
  connection: ParsedDbeaverConnection,
  idProject: string,
): IConnectionConfig => ({
  id: generateHash(),
  id_project: idProject,
  description: connection.description,
  dialect: connection.dialect,
  environment: connection.environment,
  database: connection.database,
  host: connection.host,
  port: connection.port,
  username: connection.username,
  password: connection.password,
});
