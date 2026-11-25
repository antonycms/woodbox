import type { IAIChatImage } from '../types/ai';

export const aiChatImageMimeTypes = ['image/png', 'image/jpeg', 'image/webp'] as const;
export const AI_CHAT_IMAGE_MAX_BYTES = 5 * 1024 * 1024;
export const AI_CHAT_IMAGE_MAX_BASE64_LENGTH = Math.ceil(AI_CHAT_IMAGE_MAX_BYTES / 3) * 4;

export const toAIChatImageDataUrl = (mimeType: IAIChatImage['mimeType'], data: string) =>
  `data:${mimeType};base64,${data}`;
