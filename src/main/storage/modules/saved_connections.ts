import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type Store from 'electron-store';
import { makeFnRemoveStoredItemFromArray } from '@main/storage/utils';

const STORE_KEY = 'saved_connections';
const ENCRYPTED_PREFIX = 'woodbox-enc-v1:';
const KEY_FILE_NAME = '.woodbox-credentials-key';
const DEFAULT_ENCRYPTION_KEY = 'woodbox:credentials:v1:local-key-wrapper';

let cachedEncryptionKey: string | null = null;

export const initialValue = {
  type: 'array',
  default: [] as IConnectionConfig[],
} as const;

const getConnections = (store: Store<Record<string, unknown>>) =>
  (store.get(STORE_KEY) as IConnectionConfig[] | undefined) ?? [];

const isEncryptedSecret = (secret: string) => secret.startsWith(ENCRYPTED_PREFIX);

const makeCipherKey = (key: string) => crypto.createHash('sha256').update(key).digest();

const encryptWithKey = (value: string, key: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', makeCipherKey(key), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

const decryptWithKey = (value: string, key: string) => {
  if (!isEncryptedSecret(value)) return value;

  const [iv, tag, encrypted] = value.slice(ENCRYPTED_PREFIX.length).split(':');

  if (!iv || !tag || !encrypted) {
    throw new Error('Credencial criptografada inválida.');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    makeCipherKey(key),
    Buffer.from(iv, 'base64'),
  );

  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};

const getKeyFilePath = (store: Store<Record<string, unknown>>) =>
  path.join(path.dirname(store.path), KEY_FILE_NAME);

const loadEncryptionKey = (store: Store<Record<string, unknown>>) => {
  if (cachedEncryptionKey) return cachedEncryptionKey;

  const keyFilePath = getKeyFilePath(store);

  fs.mkdirSync(path.dirname(keyFilePath), { recursive: true });

  if (!fs.existsSync(keyFilePath)) {
    const encryptionKey = crypto.randomBytes(32).toString('hex');
    const content = encryptWithKey(JSON.stringify({ encryptionKey }), DEFAULT_ENCRYPTION_KEY);

    fs.writeFileSync(keyFilePath, content, 'utf8');
  }

  const encryptedContent = fs.readFileSync(keyFilePath, 'utf8');
  const data = JSON.parse(decryptWithKey(encryptedContent, DEFAULT_ENCRYPTION_KEY)) as {
    encryptionKey?: unknown;
  };

  if (typeof data.encryptionKey !== 'string' || !data.encryptionKey) {
    throw new Error('Chave local de credenciais inválida.');
  }

  cachedEncryptionKey = data.encryptionKey;

  return cachedEncryptionKey;
};

const encodeSecret = (secret: string | undefined, encryptionKey: string) => {
  const value = secret?.trim();

  if (!value) return undefined;
  if (isEncryptedSecret(value)) return value;

  return encryptWithKey(value, encryptionKey);
};

export const decodeConnectionSecret = (secret: string | undefined, encryptionKey: string) => {
  if (!secret) return '';

  return decryptWithKey(secret, encryptionKey);
};

export const encodeConnectionSecrets = (
  connection: IConnectionConfig,
  encryptionKey: string,
  previous?: IConnectionConfig,
): IConnectionConfig => ({
  ...connection,
  username: encodeSecret(connection.username, encryptionKey),
  password:
    connection.password === undefined || connection.password === ''
      ? previous?.password
      : encodeSecret(connection.password, encryptionKey),
});

export const decodeConnectionSecrets = (
  connection: IConnectionConfig,
  encryptionKey: string,
): IConnectionConfig => ({
  ...connection,
  username: decodeConnectionSecret(connection.username, encryptionKey) || undefined,
  password: decodeConnectionSecret(connection.password, encryptionKey) || undefined,
});

export const encodeConnectionSecretsForStore = (
  store: Store<Record<string, unknown>>,
  connection: IConnectionConfig,
) => encodeConnectionSecrets(connection, loadEncryptionKey(store));

export const toPublicConnection = (
  connection: IConnectionConfig,
  encryptionKey: string,
): IConnectionPublic => {
  const { password, ...publicConnection } = decodeConnectionSecrets(connection, encryptionKey);

  return {
    ...publicConnection,
    hasPassword: !!connection.password,
  };
};

const migrateConnections = (store: Store<Record<string, unknown>>) => {
  const encryptionKey = loadEncryptionKey(store);
  const connections = getConnections(store);
  const hasLegacyCredential = connections.some(
    (connection) =>
      (!!connection.username && !isEncryptedSecret(connection.username)) ||
      (!!connection.password && !isEncryptedSecret(connection.password)),
  );

  if (!hasLegacyCredential) return;

  store.set(
    STORE_KEY,
    connections.map((connection) => encodeConnectionSecrets(connection, encryptionKey)),
  );
};

export const getModule = (store: Store<Record<string, unknown>>) => {
  migrateConnections(store);
  const encryptionKey = loadEncryptionKey(store);

  const get = ((id?: string) => {
    const connections = getConnections(store);

    if (!id) return connections.map((connection) => toPublicConnection(connection, encryptionKey));

    const connection = connections.find((item) => item.id === id);

    return connection ? toPublicConnection(connection, encryptionKey) : undefined;
  }) as {
    (): IConnectionPublic[];
    (id: string): IConnectionPublic | undefined;
  };

  const getInternal = (id: string) => {
    const connection = getConnections(store).find((item) => item.id === id);

    return connection ? decodeConnectionSecrets(connection, encryptionKey) : undefined;
  };

  const add = (connection: IConnectionConfig) => {
    const connections = getConnections(store);

    store.set(STORE_KEY, [...connections, encodeConnectionSecrets(connection, encryptionKey)]);
  };

  const remove = makeFnRemoveStoredItemFromArray<IConnectionConfig>(store, STORE_KEY);

  const edit = (id: string, connection: IConnectionConfig) => {
    const connections = getConnections(store);
    const index = connections.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error(`Item with id "${id}" in stored[${STORE_KEY}] does not exists`);
    }

    connections[index] = encodeConnectionSecrets(connection, encryptionKey, connections[index]);
    store.set(STORE_KEY, connections);
  };

  return { get, getInternal, add, remove, edit };
};
