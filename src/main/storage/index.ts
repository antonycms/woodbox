import * as store from './store';
import addListener from '@main/utils/addListener';

// project
addListener('@get:projects', store.getProjects);
addListener('@add:projects', store.addProject);
addListener('@remove:projects', store.removeProject);
addListener('@edit:projects', store.editProject);

// connections saved
addListener('@get:config_connections_saved', store.getConnectionsSaved);
addListener('@add:config_connections_saved', store.addConnectionSaved);
addListener('@remove:config_connections_saved', store.removeConnectionSaved);
addListener('@edit:config_connections_saved', store.editConnectionSaved);
addListener(
  '@post:preview_import_connections_from_source',
  store.previewImportConnectionsFromSource,
);
addListener('@post:import_connections_from_source', store.importConnectionsFromSource);

// scripts
addListener('@get:scripts_meta', store.getScriptsMeta);
addListener('@get:script_content', store.getScriptContent);
addListener('@add:scripts', store.addScript);
addListener('@remove:scripts', store.removeScript);
addListener('@patch:scripts', store.patchScript);

// snippets
addListener('@get:snippets', store.getSnippets);
addListener('@add:snippets', store.addSnippet);
addListener('@remove:snippets', store.removeSnippet);
addListener('@edit:snippets', store.editSnippet);

// ai providers
addListener('@get:ai_providers', store.getAIProviders);
addListener('@add:ai_providers', store.addAIProvider);
addListener('@remove:ai_providers', store.removeAIProvider);
addListener('@edit:ai_providers', store.editAIProvider);

// ai chats
addListener('@get:ai_chats', store.getAIChats);
addListener('@add:ai_chats', store.addAIChat);
addListener('@remove:ai_chats', store.removeAIChat);
addListener('@edit:ai_chats', store.editAIChat);
addListener('@post:append_ai_chat_messages', store.appendAIChatMessages);
