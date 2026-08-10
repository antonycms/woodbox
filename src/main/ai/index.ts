import addListener from '@main/utils/addListener';
import { sendAIChatMessage, testAIProvider } from './chat';

addListener('@post:ai_chat_message', sendAIChatMessage);
addListener('@post:test_ai_provider', testAIProvider);
