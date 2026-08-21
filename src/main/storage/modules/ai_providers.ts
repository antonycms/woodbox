import type Store from 'electron-store';
import {
  decodeSecret,
  encodeSecret,
  isLegacySafeSecret,
  isLocalEncryptedSecret,
} from '@main/storage/secret';
import { generateHash } from '@main/utils/methods';

const STORE_KEY = 'ai_providers';

export const initialValue = {
  type: 'array',
  default: [] as IAIProviderConfig[],
} as const;

const getProviders = (store: Store<Record<string, unknown>>) =>
  (store.get(STORE_KEY) as IAIProviderConfig[] | undefined) ?? [];

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
  store: Store<Record<string, unknown>>,
  data: IAIProviderInput,
  previous?: IAIProviderConfig,
): IAIProviderConfig => {
  const now = new Date().toISOString();
  const apiKey = encodeSecret(store, data.apiKey) ?? previous?.apiKey;
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

const decodeProvider = (
  store: Store<Record<string, unknown>>,
  provider: IAIProviderConfig,
): IAIProviderConfig => ({
  ...provider,
  apiKey: decodeSecret(store, provider.apiKey) || undefined,
});

const migrateProviders = (store: Store<Record<string, unknown>>) => {
  const providers = getProviders(store);
  const hasLegacySecret = providers.some(
    (provider) =>
      !!provider.apiKey &&
      !isLocalEncryptedSecret(provider.apiKey) &&
      !isLegacySafeSecret(provider.apiKey),
  );

  if (!hasLegacySecret) return;

  store.set(
    STORE_KEY,
    providers.map((provider) =>
      provider.apiKey &&
      !isLocalEncryptedSecret(provider.apiKey) &&
      !isLegacySafeSecret(provider.apiKey)
        ? { ...provider, apiKey: encodeSecret(store, decodeSecret(store, provider.apiKey)) }
        : provider,
    ),
  );
};

export const getModule = (store: Store<Record<string, unknown>>) => {
  migrateProviders(store);

  const get = () => getProviders(store).map(toPublicProvider);

  const getInternal = (id?: string) => {
    if (!id) return undefined;

    const provider = getProviders(store).find((provider) => provider.id === id);

    return provider ? decodeProvider(store, provider) : undefined;
  };

  const add = (data: IAIProviderInput) => {
    const providers = getProviders(store);
    const provider = normalizeProvider(store, data);

    store.set(STORE_KEY, [...providers, provider]);
  };

  const edit = (id: string, data: IAIProviderInput) => {
    const providers = getProviders(store);
    const index = providers.findIndex((provider) => provider.id === id);

    if (index === -1) {
      throw new Error(`Provedor de IA não encontrado: ${id}`);
    }

    providers[index] = normalizeProvider(store, { ...data, id }, providers[index]);
    store.set(STORE_KEY, providers);
  };

  const remove = (id: string) => {
    const providers = getProviders(store).filter((provider) => provider.id !== id);

    store.set(STORE_KEY, providers);
  };

  return { get, getInternal, add, edit, remove };
};
