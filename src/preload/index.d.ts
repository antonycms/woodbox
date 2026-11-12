import type { WoodboxApi } from '@shared/types/api';
import type { Environment } from 'monaco-editor';

declare global {
  interface Window {
    // Includes typed guided row changes, object commands and offline/initial table filters.
    api: WoodboxApi;
    shiftPressed?: boolean;
    ctrlPressed?: boolean;
    metaPressed?: boolean;
    MonacoEnvironment?: Environment;
  }
}
