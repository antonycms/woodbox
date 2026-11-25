import type { WoodboxApi } from '@shared/types/api';
import type { Environment } from 'monaco-editor';

declare global {
  interface Window {
    // Includes typed AI chat images, import/export progress/cancellation, updates, guided row changes and offline/initial table filters.
    api: WoodboxApi;
    shiftPressed?: boolean;
    ctrlPressed?: boolean;
    metaPressed?: boolean;
    MonacoEnvironment?: Environment;
  }
}
