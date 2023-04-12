import { editor } from 'monaco-editor';
import type { CSSProperties } from 'react';
import type { ITheme } from './theme';
import defaultTheme from './default';

export const toCssProperties = (obj: object) => {
  return Object.keys(obj).reduce((acm, key) => {
    return { ...acm, [`--${key}`]: obj[key] };
  }, {}) as CSSProperties;
};

export const serializeTheme = (theme: ITheme): ITheme<string> => {
  const { __colors } = theme;

  const eachTheme = (t) => {
    Object.keys(t).forEach((key) => {
      let value: string | object = t[key];

      if (typeof value === 'object') {
        return eachTheme(value);
      }

      if (typeof value !== 'string') return;

      const chunks = value.split('__colors.');

      if (chunks.length > 1) {
        const [, colorName] = chunks;
        value = __colors[colorName];
      }

      t[key] = value;
    });
  };

  const serializedTheme = JSON.parse(JSON.stringify(theme));

  if (typeof __colors === 'object') {
    eachTheme(serializedTheme);
  }

  return serializedTheme;
};

export const applyMonacoTheme = (theme: ITheme = defaultTheme) => {
  const { editor: colors } = serializeTheme(theme);
  const { editor: defaultColors } = serializeTheme(defaultTheme);

  const getColor = (colorName: keyof typeof colors) => {
    return colors[colorName] || defaultColors[colorName];
  };

  editor.defineTheme('active-theme', {
    base: 'vs-dark',
    inherit: true,
    rules: [
      { token: '', background: getColor('backgroundColor') },
      { token: 'keyword.sql', foreground: getColor('keywordColor') },
      { token: 'identifier.sql', foreground: getColor('identifierColor') },
      { token: 'string.sql', foreground: getColor('stringColor') },
      { token: 'number.sql', foreground: getColor('numberColor') },
      { token: 'identifier.quote.sql', foreground: getColor('identifierColor') },
      { token: 'delimiter.sql', foreground: getColor('delimiterColor') },
    ],
    colors: {
      'editor.foreground': getColor('color'),
      'editor.background': getColor('backgroundColor'),
      'editor.selectionBackground': getColor('selectionColor'),
      'editor.lineHighlightBackground': getColor('currentLineBackgroundColor'),
      'editorCursor.foreground': getColor('cursorColor'),
      'editorLineNumber.foreground': getColor('lineNumberColor'),
      'editorLineNumber.activeForeground': getColor('currentLineNumberColor'),
      // 'editorIndentGuide.activeBackground': getColor('orange'),
    },
  });
};

export const classes = (...params) => {
  let v = '';

  const add = (str) => {
    if (!str) return;
    v && (v += ' ');
    v += str;
  };

  for (const param of params) {
    if (!param) continue;

    if (typeof param === 'string' || typeof params === 'number') {
      add(param);
    } //
    else if (Array.isArray(param)) {
      param.forEach((subParam) => add(classes(subParam)));
    } //
    else {
      for (const attributeObj in param) {
        param[attributeObj] && add(attributeObj);
      }
    }
  }

  return v;
};
