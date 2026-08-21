import crypto from 'crypto';
import fs from 'fs';
import path from 'path';
import type Store from 'electron-store';

const ENCRYPTED_PREFIX = 'woodbox-enc-v1:';
const LEGACY_PLAIN_PREFIX = 'plain:';
const LEGACY_SAFE_PREFIX = 'safe:';
const KEY_FILE_NAME = '.woodbox-credentials-key';
const DEFAULT_ENCRYPTION_KEY = 'woodbox:credentials:v1:local-key-wrapper';

let cachedEncryptionKey: string | null = null;

export const isLocalEncryptedSecret = (secret: string) => secret.startsWith(ENCRYPTED_PREFIX);

export const isLegacySafeSecret = (secret: string) => secret.startsWith(LEGACY_SAFE_PREFIX);

const makeCipherKey = (key: string) => crypto.createHash('sha256').update(key).digest();

const encryptWithKey = (value: string, key: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', makeCipherKey(key), iv);
  const encrypted = Buffer.concat([cipher.update(value, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return `${ENCRYPTED_PREFIX}${iv.toString('base64')}:${tag.toString('base64')}:${encrypted.toString('base64')}`;
};

const decryptWithKey = (value: string, key: string) => {
  if (!isLocalEncryptedSecret(value)) return value;

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

export const encodeSecret = (store: Store<Record<string, unknown>>, secret?: string) => {
  const value = secret?.trim();

  if (!value) return undefined;
  if (isLocalEncryptedSecret(value)) return value;

  return encryptWithKey(value, loadEncryptionKey(store));
};

export const decodeSecret = (store: Store<Record<string, unknown>>, secret?: string) => {
  if (!secret) return '';

  if (isLegacySafeSecret(secret)) {
    throw new Error('Credencial legada incompatível. Informe a credencial novamente.');
  }

  if (secret.startsWith(LEGACY_PLAIN_PREFIX)) {
    return Buffer.from(secret.slice(LEGACY_PLAIN_PREFIX.length), 'base64').toString('utf8');
  }

  return decryptWithKey(secret, loadEncryptionKey(store));
};
