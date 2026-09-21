import type { WoodboxApi } from '@shared/types/api';
import type { IAIProviderPublic, IAIChat } from '@shared/types/ai';

export interface IAIStore {
  initialize(): Promise<void>;
  aiProviders: IAIProviderPublic[];
  aiChats: IAIChat[];
  addAIProvider: WoodboxApi['aiProviders']['add'];
  editAIProvider: WoodboxApi['aiProviders']['edit'];
  removeAIProvider: WoodboxApi['aiProviders']['remove'];
  addAIChat: WoodboxApi['aiChats']['add'];
  editAIChat: WoodboxApi['aiChats']['edit'];
  removeAIChat: WoodboxApi['aiChats']['remove'];
  appendAIChatMessages: WoodboxApi['aiChats']['appendMessages'];
  testAIProvider: WoodboxApi['aiProviders']['test'];
  sendAIChatMessage: WoodboxApi['aiChats']['sendMessage'];
  cancelAIChatMessage: WoodboxApi['aiChats']['cancelMessage'];
  getCodexChatGPTAccount: WoodboxApi['codex']['getAccount'];
  startCodexChatGPTLogin: WoodboxApi['codex']['startLogin'];
  logoutCodexChatGPT: WoodboxApi['codex']['logout'];
}

