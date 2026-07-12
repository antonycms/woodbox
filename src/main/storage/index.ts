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
