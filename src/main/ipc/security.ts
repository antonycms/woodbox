import type { IpcMainInvokeEvent, WebContents } from 'electron';

const trustedRenderers = new WeakMap<WebContents, string>();

const documentUrl = (value: string) => {
  const url = new URL(value);
  url.hash = '';
  url.search = '';
  return url.href;
};

export const trustRenderer = (contents: WebContents, url: string) => {
  trustedRenderers.set(contents, documentUrl(url));
};

export const isTrustedRenderer = (contents: WebContents): boolean => {
  const expected = trustedRenderers.get(contents);
  if (!expected || contents.isDestroyed()) return false;
  try {
    return documentUrl(contents.getURL()) === expected;
  } catch {
    return false;
  }
};

export const assertTrustedSender = (event: IpcMainInvokeEvent) => {
  if (!isTrustedRenderer(event.sender) || event.senderFrame !== event.sender.mainFrame) {
    throw new Error('Origem não autorizada para esta operação.');
  }
};
