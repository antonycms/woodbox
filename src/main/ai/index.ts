import addListener from '../utils/addListener';

let chatModule: Promise<typeof import('./chat')> | undefined;

const loadChatModule = () => {
  chatModule ??= import('./chat').catch((error: unknown) => {
    chatModule = undefined;
    throw error;
  });

  return chatModule;
};

addListener('@post:ai_chat_message', async (request) =>
  (await loadChatModule()).sendAIChatMessage(request),
);
addListener('@post:cancel_ai_chat_message', async (requestId) => {
  // Aguarda o mesmo carregamento do envio: o controller será registrado antes do cancelamento.
  if (!chatModule) return false;
  const chat = await chatModule.catch(() => undefined);
  return chat?.cancelAIChatMessage(requestId) ?? false;
});
addListener('@post:test_ai_provider', async (provider) =>
  (await loadChatModule()).testAIProvider(provider),
);
