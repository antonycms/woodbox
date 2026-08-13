import addListener from '@main/utils/addListener';
import { cancelAIChatMessage, sendAIChatMessage, testAIProvider } from './chat';

addListener('@post:ai_chat_message', sendAIChatMessage);
addListener('@post:cancel_ai_chat_message', cancelAIChatMessage);
addListener('@post:test_ai_provider', testAIProvider);
