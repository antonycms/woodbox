import type { IConnectionConfig, IConnectionPublic } from '@shared/types/connections';
import type Store from 'electron-store';
import { decodeSecret, encodeSecret, isLocalEncryptedSecret } from '@main/storage/secret';
import { makeFnRemoveStoredItemFromArray } from '@main/storage/utils';
import { mergeSshCredentials } from './ssh_credentials';

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
): IConnectionConfig => {
  const ssh = mergeSshCredentials(connection.ssh, previous?.ssh);

  return {
    ...connection,
    username: encodeSecret(store, connection.username),
    password:
      connection.password === undefined || connection.password === ''
        ? previous?.password
        : encodeSecret(store, connection.password),
    ssh: ssh ? {
      ...ssh,
      password: encodeSecret(store, ssh.password, { trim: false }),
      passphrase: encodeSecret(store, ssh.passphrase, { trim: false }),
    } : undefined,
  };
};

export const decodeConnectionSecrets = (
  store: Store<Record<string, unknown>>,
  connection: IConnectionConfig,
): IConnectionConfig => ({
  ...connection,
  username: decodeSecret(store, connection.username) || undefined,
  password: decodeSecret(store, connection.password) || undefined,
  ssh: connection.ssh ? {
    ...connection.ssh,
    password: decodeSecret(store, connection.ssh.password) || undefined,
    passphrase: decodeSecret(store, connection.ssh.passphrase) || undefined,
  } : undefined,
});

export const encodeConnectionSecretsForStore = (
  store: Store<Record<string, unknown>>,
  connection: IConnectionConfig,
) => encodeConnectionSecrets(store, connection);

export const toPublicConnection = (
  store: Store<Record<string, unknown>>,
  connection: IConnectionConfig,
): IConnectionPublic => {
  const { password, ssh, ...publicConnection } = decodeConnectionSecrets(store, connection);
  let publicSsh: IConnectionPublic['ssh'];

  if (ssh) {
    const { password: sshPassword, passphrase, ...config } = ssh;
    publicSsh = { ...config, hasPassword: !!sshPassword, hasPassphrase: !!passphrase };
  }

  return {
    ...publicConnection,
    hasPassword: !!connection.password,
    ssh: publicSsh,
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
