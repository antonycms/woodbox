import { safeStorage } from 'electron';
import type Store from 'electron-store';
import { generateHash } from '@main/utils/methods';

const STORE_KEY = 'ai_providers';
const SAFE_PREFIX = 'safe:';
const PLAIN_PREFIX = 'plain:';

export const initialValue = {
  type: 'array',
  default: [] as IAIProviderConfig[],
} as const;

const getProviders = (store: Store<Record<string, unknown>>) =>
  (store.get(STORE_KEY) as IAIProviderConfig[] | undefined) ?? [];

const encodeSecret = (secret?: string) => {
  const value = secret?.trim();

  if (!value) return undefined;

  if (safeStorage.isEncryptionAvailable()) {
    return `${SAFE_PREFIX}${safeStorage.encryptString(value).toString('base64')}`;
  }

  return `${PLAIN_PREFIX}${Buffer.from(value, 'utf8').toString('base64')}`;
};

export const decodeAIProviderSecret = (secret?: string) => {
  if (!secret) return '';

  if (secret.startsWith(SAFE_PREFIX)) {
    return safeStorage.decryptString(Buffer.from(secret.slice(SAFE_PREFIX.length), 'base64'));
  }

  if (secret.startsWith(PLAIN_PREFIX)) {
    return Buffer.from(secret.slice(PLAIN_PREFIX.length), 'base64').toString('utf8');
  }

  return secret;
};

const toPublicProvider = (provider: IAIProviderConfig): IAIProviderPublic => {
  const { apiKey: _, ...publicProvider } = provider;

  return {
    ...publicProvider,
    hasApiKey: !!provider.apiKey,
  };
};

const normalizeProvider = (
  data: IAIProviderInput,
  previous?: IAIProviderConfig,
): IAIProviderConfig => {
  const now = new Date().toISOString();
  const apiKey = encodeSecret(data.apiKey) ?? previous?.apiKey;

  return {
    id: data.id || previous?.id || generateHash(12),
    name: data.name.trim(),
    type: data.type,
    model: data.model.trim(),
    apiKey,
    baseURL: data.baseURL?.trim() || undefined,
    isDefault: !!data.isDefault,
    created_at: previous?.created_at || now,
    updated_at: now,
  };
};

const normalizeDefaultProvider = (providers: IAIProviderConfig[], defaultId?: string) => {
  const defaultProvider =
    providers.find((provider) => provider.id === defaultId) ||
    providers.find((provider) => provider.isDefault) ||
    providers[0];

  return providers.map((provider) => ({
    ...provider,
    isDefault: provider.id === defaultProvider?.id,
  }));
};

export const getModule = (store: Store<Record<string, unknown>>) => {
  const get = () => getProviders(store).map(toPublicProvider);

  const getInternal = (id?: string) => {
    const providers = getProviders(store);

    if (!id) return providers.find((provider) => provider.isDefault) || providers[0];

    return providers.find((provider) => provider.id === id);
  };

  const add = (data: IAIProviderInput) => {
    const providers = getProviders(store);
    const provider = normalizeProvider({ ...data, isDefault: data.isDefault || !providers.length });

    store.set(
      STORE_KEY,
      normalizeDefaultProvider([...providers, provider], provider.isDefault ? provider.id : undefined),
    );
  };

  const edit = (id: string, data: IAIProviderInput) => {
    const providers = getProviders(store);
    const index = providers.findIndex((provider) => provider.id === id);

    if (index === -1) {
      throw new Error(`Provedor de IA não encontrado: ${id}`);
    }

    providers[index] = normalizeProvider({ ...data, id }, providers[index]);
    store.set(STORE_KEY, normalizeDefaultProvider(providers, providers[index].isDefault ? id : undefined));
  };

  const remove = (id: string) => {
    const providers = getProviders(store).filter((provider) => provider.id !== id);

    store.set(STORE_KEY, normalizeDefaultProvider(providers));
  };

  return { get, getInternal, add, edit, remove };
};
