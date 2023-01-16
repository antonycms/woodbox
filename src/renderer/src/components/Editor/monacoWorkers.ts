import editorWorker from 'monaco-editor/esm/vs/editor/editor.worker?worker';
import jsonWorker from 'monaco-editor/esm/vs/language/json/json.worker?worker';

(self as any).MonacoEnvironment = {
  getWorker: function (_, label: string) {
    if (label === 'json') {
      return new jsonWorker();
    }

    return new editorWorker();
  },
};
