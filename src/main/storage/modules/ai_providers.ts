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

const normalizeProviderModels = (data: IAIProviderInput) =>
  data.models
    .map((model) => model.trim())
    .filter((model, index, allModels) => !!model && allModels.indexOf(model) === index);

const normalizeProvider = (
  data: IAIProviderInput,
  previous?: IAIProviderConfig,
): IAIProviderConfig => {
  const now = new Date().toISOString();
  const apiKey = encodeSecret(data.apiKey) ?? previous?.apiKey;
  const models = normalizeProviderModels(data);

  if (!models.length) {
    throw new Error('Informe ao menos um modelo de IA.');
  }

  return {
    id: data.id || previous?.id || generateHash(12),
    name: data.name.trim(),
    type: data.type,
    models,
    apiKey,
    baseURL: data.baseURL?.trim() || undefined,
    created_at: previous?.created_at || now,
    updated_at: now,
  };
};

export const getModule = (store: Store<Record<string, unknown>>) => {
  const get = () => getProviders(store).map(toPublicProvider);

  const getInternal = (id?: string) => {
    if (!id) return undefined;

    return getProviders(store).find((provider) => provider.id === id);
  };

  const add = (data: IAIProviderInput) => {
    const providers = getProviders(store);
    const provider = normalizeProvider(data);

    store.set(STORE_KEY, [...providers, provider]);
  };

  const edit = (id: string, data: IAIProviderInput) => {
    const providers = getProviders(store);
    const index = providers.findIndex((provider) => provider.id === id);

    if (index === -1) {
      throw new Error(`Provedor de IA não encontrado: ${id}`);
    }

    providers[index] = normalizeProvider({ ...data, id }, providers[index]);
    store.set(STORE_KEY, providers);
  };

  const remove = (id: string) => {
    const providers = getProviders(store).filter((provider) => provider.id !== id);

    store.set(STORE_KEY, providers);
  };

  return { get, getInternal, add, edit, remove };
};
