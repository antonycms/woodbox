import { codexRpc } from './rpc';

type CodexAccountReadResponse = {
  account: null | { type: string; email?: string | null; planType?: string | null };
};

type CodexLoginStartResponse =
  {
    type: string;
    loginId?: string;
    verificationUrl?: string;
    userCode?: string;
  };

type CodexAccountUpdated = {
  authMode?: string | null;
  planType?: string | null;
};

let lastAccountUpdate: CodexAccountUpdated = {};

codexRpc.onNotification('account/updated', (params) => {
  lastAccountUpdate = (params || {}) as CodexAccountUpdated;
});

export const getCodexChatGPTAccount = async (): Promise<ICodexChatGPTAccount> => {
  const response = await codexRpc.request<CodexAccountReadResponse>('account/read', {
    refreshToken: false,
  });
  const account = response.account;

  return {
    authenticated: account?.type === 'chatgpt',
    email: account?.email ?? null,
    planType: account?.planType ?? lastAccountUpdate.planType ?? null,
    authMode: account?.type ?? lastAccountUpdate.authMode ?? null,
  };
};

export const startCodexChatGPTLogin = async (): Promise<ICodexChatGPTLoginStart> => {
  const response = await codexRpc.request<CodexLoginStartResponse>('account/login/start', {
    type: 'chatgptDeviceCode',
  });

  if (
    response.type !== 'chatgptDeviceCode' ||
    !response.loginId ||
    !response.verificationUrl ||
    !response.userCode
  ) {
    throw new Error('Fluxo de login do Codex não retornou código de dispositivo.');
  }

  return {
    loginId: response.loginId,
    verificationUrl: response.verificationUrl,
    userCode: response.userCode,
  };
};

export const logoutCodexChatGPT = async () => {
  await codexRpc.request('account/logout', undefined, 30_000);

  lastAccountUpdate = {};
};
