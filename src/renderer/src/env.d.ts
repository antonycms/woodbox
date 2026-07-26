/// <reference types="vite/client" />
/// <reference types="vite-plugin-svgr/client" />

declare const __APP_VERSION__: string;

declare module 'monaco-editor/languages/definitions/sql/sql' {
  export const language: {
    keywords: string[];
    operators: string[];
    builtinFunctions: string[];
  };
}
