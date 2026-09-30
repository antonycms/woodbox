import crypto from 'crypto';
import type { ProjectTransferData } from '../types';

export const WOODBOX_TRANSFER_FORMAT = 'woodbox-projects';
export const WOODBOX_TRANSFER_VERSION = 1;
const WOODBOX_FILE_PREFIX = 'woodbox-transfer-enc-v1:';
const WOODBOX_TRANSFER_KEY = 'woodbox:project-transfer:v1:payload';

export type WoodboxTransferFile = ProjectTransferData & {
  format: typeof WOODBOX_TRANSFER_FORMAT;
  version: typeof WOODBOX_TRANSFER_VERSION;
  exportedAt: string;
};

const makeCipherKey = (key: string) => crypto.createHash('sha256').update(key).digest();

export const encryptWoodboxFile = (content: string) => {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', makeCipherKey(WOODBOX_TRANSFER_KEY), iv);
  const encrypted = Buffer.concat([cipher.update(content, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return WOODBOX_FILE_PREFIX + [
    iv.toString('base64'),
    tag.toString('base64'),
    encrypted.toString('base64'),
  ].join(':');
};

export const decryptWoodboxFile = (content: string) => {
  const value = content.trim();

  if (!value.startsWith(WOODBOX_FILE_PREFIX)) {
    throw new Error('Arquivo Woodbox inválido.');
  }

  const [iv, tag, encrypted] = value.slice(WOODBOX_FILE_PREFIX.length).split(':');

  if (!iv || !tag || !encrypted) {
    throw new Error('Arquivo Woodbox criptografado inválido.');
  }

  const decipher = crypto.createDecipheriv(
    'aes-256-gcm',
    makeCipherKey(WOODBOX_TRANSFER_KEY),
    Buffer.from(iv, 'base64'),
  );

  decipher.setAuthTag(Buffer.from(tag, 'base64'));

  return Buffer.concat([
    decipher.update(Buffer.from(encrypted, 'base64')),
    decipher.final(),
  ]).toString('utf8');
};
