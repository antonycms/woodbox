import type Store from 'electron-store';

type SshHost = { host: string; port: number; fingerprint: string };
type AppStore = Store<Record<string, unknown>>;

const STORE_KEY = 'ssh_hosts';

export const initialValue = {
  type: 'array',
  default: [] as SshHost[],
} as const;

const getHosts = (store: AppStore) => (store.get(STORE_KEY) as SshHost[] | undefined) ?? [];

export const getModule = (store: AppStore) => {
  const getFingerprint = (host: string, port: number) =>
    getHosts(store).find((item) => item.host === host && item.port === port)?.fingerprint;

  const saveFingerprint = (host: string, port: number, fingerprint: string) => {
    const hosts = getHosts(store);
    store.set(STORE_KEY, [
      ...hosts.filter((item) => item.host !== host || item.port !== port),
      { host, port, fingerprint },
    ]);
  };

  return { getFingerprint, saveFingerprint };
};
