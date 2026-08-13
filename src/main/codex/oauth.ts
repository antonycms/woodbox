import { safeStorage } from 'electron';
import Store from 'electron-store';

const ISSUER = 'https://auth.openai.com';
const CLIENT_ID = 'app_EMoamEEZ73f0CkXaXp7hrann';
const STORE_KEY = 'codex_chatgpt_auth';
const SAFE_PREFIX = 'safe:';
const PLAIN_PREFIX = 'plain:';

type TokenResponse = {
  id_token?: string;
  access_token: string;
  refresh_token: string;
  expires_in?: number;
};

type CodexDeviceTokenResponse = {
  authorization_code: string;
  code_verifier: string;
};

export type CodexCredential = {
  accessToken: string;
  refreshToken?: string;
  expiresAt?: number;
  accountId?: string;
  email?: string;
};

export type CodexDeviceAuthorization = {
  deviceAuthId: string;
  userCode: string;
  verificationUrl: string;
  intervalMs: number;
};

type StoredCodexCredential = {
  accessToken: string;
  refreshToken: string;
  expiresAt: number;
  accountId?: string;
  email?: string;
};

type JwtClaims = {
  exp?: number;
  email?: string;
  chatgpt_account_id?: string;
  organizations?: Array<{ id?: string }>;
  'https://api.openai.com/auth'?: {
    chatgpt_account_id?: string;
  };
};

const store = new Store<Record<string, unknown>>({ name: 'codex_auth' });

const encodeSecret = (secret: string) => {
  if (safeStorage.isEncryptionAvailable()) {
    return `${SAFE_PREFIX}${safeStorage.encryptString(secret).toString('base64')}`;
  }

  return `${PLAIN_PREFIX}${Buffer.from(secret, 'utf8').toString('base64')}`;
};

const decodeSecret = (secret: string) => {
  if (secret.startsWith(SAFE_PREFIX)) {
    return safeStorage.decryptString(Buffer.from(secret.slice(SAFE_PREFIX.length), 'base64'));
  }

  if (secret.startsWith(PLAIN_PREFIX)) {
    return Buffer.from(secret.slice(PLAIN_PREFIX.length), 'base64').toString('utf8');
  }

  return secret;
};

export const parseJwtClaims = (token: string): JwtClaims | undefined => {
  const [, payload] = token.split('.');

  if (!payload) return undefined;

  try {
    return JSON.parse(Buffer.from(payload, 'base64url').toString('utf8')) as JwtClaims;
  } catch {
    return undefined;
  }
};

export const extractAccountIdFromClaims = (claims?: JwtClaims) => {
  return (
    claims?.chatgpt_account_id ||
    claims?.['https://api.openai.com/auth']?.chatgpt_account_id ||
    claims?.organizations?.find((organization) => !!organization.id)?.id
  );
};

const toCredential = (tokens: TokenResponse): StoredCodexCredential => {
  const accessClaims = parseJwtClaims(tokens.access_token);
  const idClaims = tokens.id_token ? parseJwtClaims(tokens.id_token) : undefined;
  const expiresAt = Date.now() + (tokens.expires_in ?? 3600) * 1000;

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
    expiresAt,
    accountId: extractAccountIdFromClaims(idClaims) || extractAccountIdFromClaims(accessClaims),
    email: idClaims?.email || accessClaims?.email,
  };
};

const saveCredential = (credential: StoredCodexCredential) => {
  store.set(STORE_KEY, {
    ...credential,
    accessToken: encodeSecret(credential.accessToken),
    refreshToken: encodeSecret(credential.refreshToken),
  });
};

export const getStoredCodexCredential = (): StoredCodexCredential | undefined => {
  const raw = store.get(STORE_KEY) as StoredCodexCredential | undefined;

  if (!raw?.accessToken || !raw.refreshToken || !raw.expiresAt) return undefined;

  return {
    ...raw,
    accessToken: decodeSecret(raw.accessToken),
    refreshToken: decodeSecret(raw.refreshToken),
  };
};

export const clearStoredCodexCredential = () => {
  store.delete(STORE_KEY);
};

export const getEnvCodexCredential = (): CodexCredential | undefined => {
  const accessToken = process.env.OPENAI_CODEX_OAUTH_TOKEN?.trim();

  if (!accessToken) return undefined;

  const claims = parseJwtClaims(accessToken);

  return {
    accessToken,
    expiresAt: claims?.exp ? claims.exp * 1000 : undefined,
    accountId: extractAccountIdFromClaims(claims),
    email: claims?.email,
  };
};

export const isCredentialExpired = (credential: Pick<CodexCredential, 'expiresAt'>) => {
  return !!credential.expiresAt && credential.expiresAt <= Date.now() + 30_000;
};

const requestJson = async <Result>(url: string, init: RequestInit): Promise<Result> => {
  const response = await fetch(url, init);

  if (!response.ok) {
    throw new Error(`Falha na autenticação Codex (${response.status}).`);
  }

  return (await response.json()) as Result;
};

export const startDeviceAuthorization = async (): Promise<CodexDeviceAuthorization> => {
  const response = await requestJson<{
    device_auth_id: string;
    user_code: string;
    interval?: string;
  }>(`${ISSUER}/api/accounts/deviceauth/usercode`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent': 'woodbox/1.0.0',
    },
    body: JSON.stringify({ client_id: CLIENT_ID }),
  });

  return {
    deviceAuthId: response.device_auth_id,
    userCode: response.user_code,
    verificationUrl: `${ISSUER}/codex/device`,
    intervalMs: Math.max(Number(response.interval) || 5, 1) * 1000,
  };
};

export const pollDeviceAuthorization = async (authorization: CodexDeviceAuthorization) => {
  const startedAt = Date.now();

  while (Date.now() - startedAt < 5 * 60 * 1000) {
    const response = await fetch(`${ISSUER}/api/accounts/deviceauth/token`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'woodbox/1.0.0',
      },
      body: JSON.stringify({
        device_auth_id: authorization.deviceAuthId,
        user_code: authorization.userCode,
      }),
    });

    if (response.ok) {
      const data = (await response.json()) as CodexDeviceTokenResponse;
      const tokens = await requestJson<TokenResponse>(`${ISSUER}/oauth/token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          grant_type: 'authorization_code',
          code: data.authorization_code,
          redirect_uri: `${ISSUER}/deviceauth/callback`,
          client_id: CLIENT_ID,
          code_verifier: data.code_verifier,
        }).toString(),
      });

      saveCredential(toCredential(tokens));
      return;
    }

    if (response.status !== 403 && response.status !== 404) {
      throw new Error(`Login Codex recusado (${response.status}).`);
    }

    await new Promise((resolve) => setTimeout(resolve, authorization.intervalMs + 3000));
  }

  throw new Error('Tempo esgotado aguardando autorização do ChatGPT.');
};

export const refreshStoredCodexCredential = async (credential: StoredCodexCredential) => {
  const tokens = await requestJson<TokenResponse>(`${ISSUER}/oauth/token`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: credential.refreshToken,
      client_id: CLIENT_ID,
    }).toString(),
  });
  const nextCredential = toCredential(tokens);

  saveCredential(nextCredential);

  return nextCredential;
};
