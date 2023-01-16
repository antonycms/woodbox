import * as monaco from 'monaco-editor';
import { getHexadecimalColors } from '@renderer/styles/theme2';

const colors = getHexadecimalColors();

window.addEventListener('on-change-theme', (e: CustomEvent) => {
  console.log('oiii>> ', e.detail);
});

monaco.editor.defineTheme('default-theme', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    {
      background: colors.dark,
      token: '',
    },
    {
      foreground: colors.purple,
      token: 'keyword.sql',
    },
    {
      foreground: colors.orange,
      token: 'identifier.sql',
    },
    {
      foreground: colors.green,
      token: 'string.sql',
    },
    {
      foreground: colors.pink,
      token: 'number.sql',
    },
    {
      foreground: colors.orange,
      token: 'identifier.quote.sql',
    },
    {
      foreground: colors.blueTransparent,
      token: 'delimiter.sql',
    },
  ],
  colors: {
    'editor.foreground': colors.white,
    'editor.background': colors.dark,
    'editor.selectionBackground': colors.purpleDark,
    'editor.lineHighlightBackground': colors.darkLight,
    'editorCursor.foreground': colors.white,
    'editorIndentGuide.activeBackground': colors.orange,
  },
});
