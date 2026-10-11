import * as store from './store';
import addListener from '../utils/addListener';

// project
addListener('@get:projects', store.getProjects);
addListener('@post:projects', store.addProject);
addListener('@delete:project', store.removeProject);
addListener('@post:update_project', store.editProject);

// connections saved
addListener('@get:config_connections_saved', () => store.getConnectionsSaved());
addListener('@get:config_connection_saved', (id) => store.getConnectionsSaved(id));
addListener('@post:config_connections_saved', store.addConnectionSaved);
addListener('@delete:config_connection_saved', store.removeConnectionSaved);
addListener('@post:update_config_connection_saved', (id, data) =>
  store.editConnectionSaved(id, { ...data, id }),
);
addListener(
  '@post:preview_import_connections_from_source',
  store.previewImportConnectionsFromSource,
);
addListener('@post:import_connections_from_source', store.importConnectionsFromSource);
addListener('@post:export_projects', store.exportProjects);

// scripts
addListener('@get:scripts_meta', store.getScriptsMeta);
addListener('@get:script_content', store.getScriptContent);
addListener('@post:scripts', (data) => store.addScript({ ...data, content: data.content ?? '' }));
addListener('@delete:script', store.removeScript);
addListener('@post:update_script', store.patchScript);

// snippets
addListener('@get:snippets', store.getSnippets);
addListener('@post:snippets', store.addSnippet);
addListener('@delete:snippet', store.removeSnippet);
addListener('@post:update_snippet', store.editSnippet);

// ai providers
addListener('@get:ai_providers', store.getAIProviders);
addListener('@post:ai_providers', store.addAIProvider);
addListener('@delete:ai_provider', store.removeAIProvider);
addListener('@post:update_ai_provider', store.editAIProvider);

// ai chats
addListener('@get:ai_chats', store.getAIChats);
addListener('@post:ai_chats', store.addAIChat);
addListener('@delete:ai_chat', store.removeAIChat);
addListener('@post:update_ai_chat', store.editAIChat);
addListener('@post:append_ai_chat_messages', store.appendAIChatMessages);

// preferences
addListener('@get:app_preferences', store.getAppPreferences);
addListener('@post:app_preferences', store.updateAppPreferences);
