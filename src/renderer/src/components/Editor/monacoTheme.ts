import { editor } from 'monaco-editor';
import { getHexadecimalColors } from '@renderer/styles/theme2';

const colors = getHexadecimalColors();

editor.defineTheme('default-theme', {
  base: 'vs-dark',
  inherit: true,
  rules: [
    { token: '', background: colors.dark },
    { token: 'keyword.sql', foreground: colors.purple },
    { token: 'identifier.sql', foreground: colors.orange },
    { token: 'string.sql', foreground: colors.green },
    { token: 'number.sql', foreground: colors.pink },
    { token: 'identifier.quote.sql', foreground: colors.orange },
    { token: 'delimiter.sql', foreground: colors.blueTransparent },
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
