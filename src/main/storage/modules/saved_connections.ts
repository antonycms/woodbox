import type Store from 'electron-store';
import { decodeSecret, encodeSecret, isLocalEncryptedSecret } from '@main/storage/secret';
import { makeFnRemoveStoredItemFromArray } from '@main/storage/utils';

const STORE_KEY = 'saved_connections';

export const initialValue = {
  type: 'array',
  default: [] as IConnectionConfig[],
} as const;

const getConnections = (store: Store<Record<string, unknown>>) =>
  (store.get(STORE_KEY) as IConnectionConfig[] | undefined) ?? [];

export const encodeConnectionSecrets = (
  store: Store<Record<string, unknown>>,
  connection: IConnectionConfig,
  previous?: IConnectionConfig,
): IConnectionConfig => ({
  ...connection,
  username: encodeSecret(store, connection.username),
  password:
    connection.password === undefined || connection.password === ''
      ? previous?.password
      : encodeSecret(store, connection.password),
});

export const decodeConnectionSecrets = (
  store: Store<Record<string, unknown>>,
  connection: IConnectionConfig,
): IConnectionConfig => ({
  ...connection,
  username: decodeSecret(store, connection.username) || undefined,
  password: decodeSecret(store, connection.password) || undefined,
});

export const encodeConnectionSecretsForStore = (
  store: Store<Record<string, unknown>>,
  connection: IConnectionConfig,
) => encodeConnectionSecrets(store, connection);

export const toPublicConnection = (
  store: Store<Record<string, unknown>>,
  connection: IConnectionConfig,
): IConnectionPublic => {
  const { password, ...publicConnection } = decodeConnectionSecrets(store, connection);

  return {
    ...publicConnection,
    hasPassword: !!connection.password,
  };
};

const migrateConnections = (store: Store<Record<string, unknown>>) => {
  const connections = getConnections(store);
  const hasLegacyCredential = connections.some(
    (connection) =>
      (!!connection.username && !isLocalEncryptedSecret(connection.username)) ||
      (!!connection.password && !isLocalEncryptedSecret(connection.password)),
  );

  if (!hasLegacyCredential) return;

  store.set(
    STORE_KEY,
    connections.map((connection) => encodeConnectionSecrets(store, connection)),
  );
};

export const getModule = (store: Store<Record<string, unknown>>) => {
  migrateConnections(store);

  const get = ((id?: string) => {
    const connections = getConnections(store);

    if (!id) return connections.map((connection) => toPublicConnection(store, connection));

    const connection = connections.find((item) => item.id === id);

    return connection ? toPublicConnection(store, connection) : undefined;
  }) as {
    (): IConnectionPublic[];
    (id: string): IConnectionPublic | undefined;
  };

  const getInternal = (id: string) => {
    const connection = getConnections(store).find((item) => item.id === id);

    return connection ? decodeConnectionSecrets(store, connection) : undefined;
  };

  const add = (connection: IConnectionConfig) => {
    const connections = getConnections(store);

    store.set(STORE_KEY, [...connections, encodeConnectionSecrets(store, connection)]);
  };

  const remove = makeFnRemoveStoredItemFromArray<IConnectionConfig>(store, STORE_KEY);

  const edit = (id: string, connection: IConnectionConfig) => {
    const connections = getConnections(store);
    const index = connections.findIndex((item) => item.id === id);

    if (index === -1) {
      throw new Error(`Item with id "${id}" in stored[${STORE_KEY}] does not exists`);
    }

    connections[index] = encodeConnectionSecrets(store, connection, connections[index]);
    store.set(STORE_KEY, connections);
  };

  return { get, getInternal, add, remove, edit };
};
