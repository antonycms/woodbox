import type { WoodboxApi } from '@shared/types/api';
import type { Environment } from 'monaco-editor';

declare global {
  interface Window {
    api: WoodboxApi;
    shiftPressed?: boolean;
    ctrlPressed?: boolean;
    metaPressed?: boolean;
    MonacoEnvironment?: Environment;
  }
}
