import addListener from '@main/utils/addListener';
import {
  getCodexChatGPTAccount,
  logoutCodexChatGPT,
  startCodexChatGPTLogin,
} from './account';

addListener('@get:codex_chatgpt_account', getCodexChatGPTAccount);
addListener('@post:codex_chatgpt_login', startCodexChatGPTLogin);
addListener('@post:codex_chatgpt_logout', logoutCodexChatGPT);
