import {
  clearStoredCodexCredential,
  getEnvCodexCredential,
  getStoredCodexCredential,
  isCredentialExpired,
  pollDeviceAuthorization,
  refreshStoredCodexCredential,
  startDeviceAuthorization,
  type CodexCredential,
} from './oauth';

let pendingLogin: Promise<void> | undefined;

export const getValidCodexCredential = async (): Promise<CodexCredential | undefined> => {
  const envCredential = getEnvCodexCredential();

  if (envCredential) {
    if (isCredentialExpired(envCredential)) return undefined;

    return envCredential;
  }

  const storedCredential = getStoredCodexCredential();

  if (!storedCredential) return undefined;

  if (!isCredentialExpired(storedCredential)) return storedCredential;

  return await refreshStoredCodexCredential(storedCredential);
};

export const getCodexChatGPTAccount = async (): Promise<ICodexChatGPTAccount> => {
  const credential = await getValidCodexCredential();

  return {
    authenticated: !!credential,
    email: credential?.email ?? null,
    planType: null,
    authMode: credential ? 'chatgpt' : null,
  };
};

export const startCodexChatGPTLogin = async (): Promise<ICodexChatGPTLoginStart> => {
  const authorization = await startDeviceAuthorization();

  pendingLogin = pollDeviceAuthorization(authorization).finally(() => {
    pendingLogin = undefined;
  });
  pendingLogin.catch(() => undefined);

  return {
    loginId: authorization.deviceAuthId,
    verificationUrl: authorization.verificationUrl,
    userCode: authorization.userCode,
  };
};

export const logoutCodexChatGPT = async () => {
  clearStoredCodexCredential();
};
