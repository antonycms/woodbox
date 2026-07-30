import { editor } from '@renderer/components/Editor/monaco';
import type { ITheme } from './theme';
import defaultTheme from './default';

export function toCssProperties(obj: object) {
  const cssProperties: React.CSSProperties = {};

  for (const key in obj) {
    cssProperties[`--${key}`] = obj[key];
  }

  return cssProperties;
}

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

const isLightHexColor = (color?: string) => {
  if (!color) return false;

  const hex = color.replace('#', '').slice(0, 6);

  if (!/^[0-9a-f]{6}$/i.test(hex)) return false;

  const red = Number.parseInt(hex.slice(0, 2), 16);
  const green = Number.parseInt(hex.slice(2, 4), 16);
  const blue = Number.parseInt(hex.slice(4, 6), 16);

  return (red * 299 + green * 587 + blue * 114) / 1000 > 180;
};

const withAlpha = (color: string, alpha: string) => {
  const hex = color.replace('#', '');

  if (!/^[0-9a-f]{6}([0-9a-f]{2})?$/i.test(hex)) return color;

  return `#${hex.slice(0, 6)}${alpha}`;
};

export const applyMonacoTheme = (theme: ITheme = defaultTheme) => {
  const { editor: colors } = serializeTheme(theme);
  const { editor: defaultColors } = serializeTheme(defaultTheme);

  const getColor = (colorName: keyof typeof colors) => {
    return colors[colorName] || defaultColors[colorName];
  };
  const themeBase = isLightHexColor(getColor('backgroundColor')) ? 'vs' : 'vs-dark';

  editor.defineTheme('active-theme', {
    base: themeBase,
    inherit: true,
    rules: [
      { token: '', background: getColor('backgroundColor') },
      { token: 'keyword.sql', foreground: getColor('keywordColor') },
      { token: 'identifier.sql', foreground: getColor('identifierColor') },
      { token: 'type.sql', foreground: getColor('stringColor') },
      { token: 'predefined.sql', foreground: getColor('stringColor') },
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

      'editorWidget.foreground': getColor('color'),
      'editorWidget.background': getColor('backgroundColor'),
      'editorWidget.border': getColor('currentLineBackgroundColor'),
      'editorWidget.resizeBorder': getColor('selectionColor'),
      'widget.border': getColor('currentLineBackgroundColor'),
      'input.foreground': getColor('color'),
      'input.background': getColor('currentLineBackgroundColor'),
      'input.border': getColor('currentLineBackgroundColor'),
      'input.placeholderForeground': getColor('lineNumberColor'),
      focusBorder: getColor('cursorColor'),
      disabledForeground: getColor('lineNumberColor'),
      'toolbar.hoverBackground': getColor('selectionColor'),
      'editor.findMatchBackground': withAlpha(getColor('identifierColor'), '80'),
      'editor.findMatchHighlightBackground': withAlpha(getColor('keywordColor'), '55'),
      'editor.findMatchBorder': getColor('identifierColor'),
      'editor.findMatchHighlightBorder': withAlpha(getColor('keywordColor'), 'aa'),
      'editor.findRangeHighlightBackground': withAlpha(getColor('selectionColor'), '40'),
      'editor.findRangeHighlightBorder': getColor('selectionColor'),
      // 'editorIndentGuide.activeBackground': getColor('orange'),
    },
  });
};

export const classes = (...params) => {
  let v = '';

  const add = (str: string) => {
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
      for (const subParam of param) {
        add(classes(subParam));
      }
    } //
    else if (typeof param === 'object') {
      for (const attributeObj in param) {
        param[attributeObj] && add(attributeObj);
      }
    }
  }

  return v;
};
