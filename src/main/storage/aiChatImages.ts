import { app } from 'electron';
import { mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { IAIChatImage } from '@shared/types/ai';
import {
  AI_CHAT_IMAGE_MAX_BASE64_LENGTH,
  AI_CHAT_IMAGE_MAX_BYTES,
  toAIChatImageDataUrl,
} from '@shared/utils/aiChatImages';

const imagePath = (id: string) => {
  if (!/^[\da-f]{8}(?:-[\da-f]{4}){3}-[\da-f]{12}$/i.test(id)) {
    throw new Error('Identificador de imagem inválido.');
  }
  return join(app.getPath('userData'), 'ai-chat-images', id.toLowerCase());
};

const validateImageBytes = (bytes: Buffer, mimeType: IAIChatImage['mimeType']) => {
  if (!bytes.length || bytes.length > AI_CHAT_IMAGE_MAX_BYTES) {
    throw new Error('A imagem precisa ter até 5 MB.');
  }
  const matches = mimeType === 'image/png'
    ? bytes.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]))
    : mimeType === 'image/jpeg'
      ? bytes.subarray(0, 3).equals(Buffer.from([255, 216, 255]))
      : mimeType === 'image/webp' &&
        bytes.toString('ascii', 0, 4) === 'RIFF' &&
        bytes.toString('ascii', 8, 12) === 'WEBP';
  if (!matches) throw new Error('O conteúdo da imagem não corresponde a PNG, JPEG ou WebP.');
  return bytes;
};

const decodeImage = (data: string, mimeType: IAIChatImage['mimeType']) => {
  if (data.length > AI_CHAT_IMAGE_MAX_BASE64_LENGTH) throw new Error('A imagem precisa ter até 5 MB.');
  const bytes = Buffer.from(data, 'base64');
  if (bytes.toString('base64') !== data) throw new Error('Conteúdo de imagem inválido.');
  return validateImageBytes(bytes, mimeType);
};

export const readChatImageDataUrl = async ({ id, mimeType }: Omit<IAIChatImage, 'data'>) => {
  const bytes = validateImageBytes(await readFile(imagePath(id)), mimeType);
  return toAIChatImageDataUrl(mimeType, bytes.toString('base64'));
};

export const resolveChatImageDataUrl = (image: IAIChatImage) =>
  image.data
    ? toAIChatImageDataUrl(image.mimeType, decodeImage(image.data, image.mimeType).toString('base64'))
    : readChatImageDataUrl(image);

export const storeChatImage = async ({ id, mimeType, data }: IAIChatImage) => {
  if (!data) return;
  const path = imagePath(id);
  const bytes = decodeImage(data, mimeType);
  await mkdir(join(app.getPath('userData'), 'ai-chat-images'), { recursive: true, mode: 0o700 });
  await writeFile(path, bytes, { flag: 'wx', mode: 0o600 });
};

export const removeChatImage = (id: string) => rm(imagePath(id), { force: true });
