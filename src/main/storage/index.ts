import * as store from './store';
import addListener from '../utils/addListener';

// dialect
addListener('@get:dialects', store.getDialects);

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
