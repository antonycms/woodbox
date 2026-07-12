import type { ITheme } from './theme';
import defaultTheme from './default';
import { serializeTheme } from './utils';

const graphiteColors = {
  ...defaultTheme.__colors,
  green: '#8fd6c3',
  greenDeep: '#4f9d8a',
  orange: '#d7b377',
  orangeDeep: '#b8863d',
  purple: '#9ba7ff',
  purpleDark: '#353b647f',
  pink: '#e8a4c5',
  blue: '#9ed7e6',
  dark: '#17191d',
  darkLightBar: '#202329',
  darkLightDeep: '#252932',
  backgroundContextMenu: '#181b22',
  border: '#101217',
};

const amberColors = {
  ...defaultTheme.__colors,
  green: '#e6bf75',
  greenDeep: '#b9893b',
  orange: '#ffcf8a',
  orangeDeep: '#c58a35',
  purple: '#d6a45f',
  purpleDark: '#5f45257f',
  pink: '#e7a98d',
  blue: '#8fc8d8',
  dark: '#1f1b17',
  darkLightBar: '#29231c',
  darkLightDeep: '#302820',
  backgroundContextMenu: '#251d16',
  border: '#17120d',
};

const draculaColors = {
  ...defaultTheme.__colors,
  purple: '#bd93f9',
  purpleDark: '#44475a7f',
  blueTransparent: '#6272a459',
  green: '#50fa7b',
  greenDeep: '#3fc765',
  orange: '#ffb86c',
  orangeDeep: '#d99655',
  greenTransparent: '#50fa7b1a',
  pink: '#ff79c6',
  blue: '#8be9fd',
  red: '#ff5555',
  redDeep: '#d64242',
  white: '#f8f8f2',
  gray: '#6272a4',
  lightGray: '#44475a7f',
  dark: '#282a36',
  darkLight: '#44475a3d',
  darkLightBar: '#21222c',
  darkLightDeep: '#343746',
  backgroundContextMenu: '#21222c',
  border: '#191a21',
};

const oneDarkProColors = {
  ...defaultTheme.__colors,
  purple: '#c678dd',
  purpleDark: '#4b3b5a7f',
  blueTransparent: '#61afef59',
  green: '#98c379',
  greenDeep: '#6f9f55',
  orange: '#d19a66',
  orangeDeep: '#b57b42',
  greenTransparent: '#98c3791a',
  pink: '#e06c75',
  blue: '#61afef',
  red: '#e06c75',
  redDeep: '#be5046',
  white: '#abb2bf',
  gray: '#5c6370',
  lightGray: '#3e44517f',
  dark: '#282c34',
  darkLight: '#3e44513d',
  darkLightBar: '#21252b',
  darkLightDeep: '#2c313a',
  backgroundContextMenu: '#21252b',
  border: '#181a1f',
};

const githubDarkColors = {
  ...defaultTheme.__colors,
  purple: '#d2a8ff',
  purpleDark: '#6e40c97f',
  blueTransparent: '#58a6ff59',
  green: '#7ee787',
  greenDeep: '#3fb950',
  orange: '#ffa657',
  orangeDeep: '#d29922',
  greenTransparent: '#7ee7871a',
  pink: '#ff7b72',
  blue: '#58a6ff',
  red: '#ff7b72',
  redDeep: '#da3633',
  white: '#c9d1d9',
  gray: '#8b949e',
  lightGray: '#30363d7f',
  dark: '#0d1117',
  darkLight: '#30363d3d',
  darkLightBar: '#161b22',
  darkLightDeep: '#21262d',
  backgroundContextMenu: '#161b22',
  border: '#30363d',
};

const catppuccinMochaColors = {
  ...defaultTheme.__colors,
  purple: '#cba6f7',
  purpleDark: '#6c4f937f',
  blueTransparent: '#89b4fa59',
  green: '#a6e3a1',
  greenDeep: '#74c77a',
  orange: '#fab387',
  orangeDeep: '#d48a62',
  greenTransparent: '#a6e3a11a',
  pink: '#f5c2e7',
  blue: '#89b4fa',
  red: '#f38ba8',
  redDeep: '#d65d7a',
  white: '#cdd6f4',
  gray: '#7f849c',
  lightGray: '#45475a7f',
  dark: '#1e1e2e',
  darkLight: '#45475a3d',
  darkLightBar: '#181825',
  darkLightDeep: '#313244',
  backgroundContextMenu: '#181825',
  border: '#11111b',
};

const auraLightColors = {
  ...defaultTheme.__colors,
  purple: '#7c3aed',
  purpleDark: '#c4b5fd7f',
  blueTransparent: '#2563eb33',
  green: '#008f6b',
  greenDeep: '#007a5a',
  orange: '#b87513',
  orangeDeep: '#9a5f00',
  greenTransparent: '#00a8781a',
  pink: '#b832c7',
  blue: '#087ea4',
  red: '#d14343',
  redDeep: '#b42318',
  white: '#20212a',
  gray: '#697386',
  lightGray: '#d8dee87f',
  dark: '#f7f4ff',
  darkLight: '#e9e3f83d',
  darkLightBar: '#f3effc',
  darkLightDeep: '#ece8f7',
  backgroundContextMenu: '#f7f4ff',
  border: '#d8d1e8',
};

const oneLightProColors = {
  ...defaultTheme.__colors,
  purple: '#a626a4',
  purpleDark: '#d7b8f37f',
  blueTransparent: '#4078f233',
  green: '#50a14f',
  greenDeep: '#3f8f3e',
  orange: '#c18401',
  orangeDeep: '#986801',
  greenTransparent: '#50a14f1a',
  pink: '#e45649',
  blue: '#4078f2',
  red: '#e45649',
  redDeep: '#ca1243',
  white: '#383a42',
  gray: '#696c77',
  lightGray: '#d0d0d07f',
  dark: '#fafafa',
  darkLight: '#e5e5e63d',
  darkLightBar: '#f0f0f0',
  darkLightDeep: '#e5e5e6',
  backgroundContextMenu: '#f6f6f7',
  border: '#d0d0d0',
};

const githubLightColors = {
  ...defaultTheme.__colors,
  purple: '#8250df',
  purpleDark: '#d8b9ff7f',
  blueTransparent: '#0969da33',
  green: '#1a7f37',
  greenDeep: '#116329',
  orange: '#9a6700',
  orangeDeep: '#7d4e00',
  greenTransparent: '#1a7f371a',
  pink: '#cf222e',
  blue: '#0969da',
  red: '#cf222e',
  redDeep: '#a40e26',
  white: '#24292f',
  gray: '#57606a',
  lightGray: '#c6ced87f',
  dark: '#f3f6fa',
  darkLight: '#cfd8e33d',
  darkLightBar: '#e9eef5',
  darkLightDeep: '#dfe6ef',
  backgroundContextMenu: '#f3f6fa',
  border: '#c6ced8',
};

const catppuccinLatteColors = {
  ...defaultTheme.__colors,
  purple: '#8839ef',
  purpleDark: '#cba6f77f',
  blueTransparent: '#1e66f533',
  green: '#40a02b',
  greenDeep: '#2b8a1f',
  orange: '#fe640b',
  orangeDeep: '#df4f00',
  greenTransparent: '#40a02b1a',
  pink: '#ea76cb',
  blue: '#1e66f5',
  red: '#d20f39',
  redDeep: '#b70f2f',
  white: '#4c4f69',
  gray: '#6c6f85',
  lightGray: '#ccd0da7f',
  dark: '#eff1f5',
  darkLight: '#dce0e83d',
  darkLightBar: '#e6e9ef',
  darkLightDeep: '#dce0e8',
  backgroundContextMenu: '#eff1f5',
  border: '#ccd0da',
};

type BuiltinColors = typeof defaultTheme.__colors & Record<string, string>;
type ThemeOverrides = Partial<ITheme<string>>;

const isRecord = (value: unknown): value is Record<string, unknown> => {
  return !!value && typeof value === 'object' && !Array.isArray(value);
};

const mergeTheme = (theme: ITheme, overrides?: ThemeOverrides): ITheme => {
  if (!overrides) return theme;

  const merge = (target: Record<string, unknown>, source: Record<string, unknown>) => {
    for (const key in source) {
      const sourceValue = source[key];
      const targetValue = target[key];

      if (isRecord(targetValue) && isRecord(sourceValue)) {
        target[key] = merge({ ...targetValue }, sourceValue);
        continue;
      }

      target[key] = sourceValue;
    }

    return target;
  };

  const clonedTheme = JSON.parse(JSON.stringify(theme)) as Record<string, unknown>;

  return merge(clonedTheme, overrides as Record<string, unknown>) as unknown as ITheme;
};

const createTheme = (
  name: string,
  __colors: BuiltinColors,
  overrides?: ThemeOverrides,
): ITheme => {
  return mergeTheme(
    {
      ...defaultTheme,
      name,
      __colors,
    },
    overrides,
  );
};

const auraLightThemeOverrides: ThemeOverrides = {
  welcome: {
    color: '__colors.white',
    backgroundColor: '__colors.dark',
  },
  sideBar: {
    menuBar: {
      color: '__colors.white',
      backgroundColor: '__colors.darkLightBar',
      ascentColor: '__colors.green',
    },
    color: '__colors.white',
    backgroundColor: '__colors.dark',
    fieldColor: '__colors.white',
    fieldPlaceholderColor: '__colors.gray',
    fieldBackgroundColor: '__colors.darkLightDeep',
    fieldLabelColor: '__colors.white',
    borderColor: '__colors.border',
  },
  mainTab: {
    bar: {
      backgroundColor: '__colors.dark',
      borderColor: '__colors.border',
    },
    color: '__colors.white',
    backgroundColor: '__colors.darkLightBar',
    ascentColor: '__colors.green',
    borderColor: '__colors.border',
  },
  contextMenu: {
    color: '__colors.white',
    backgroundColor: '__colors.backgroundContextMenu',
    borderColor: '__colors.border',
  },
  editor: {
    lineNumberColor: '__colors.gray',
    currentLineNumberColor: '__colors.white',
    cursorColor: '__colors.white',
    color: '__colors.white',
    backgroundColor: '__colors.darkLightBar',
    selectionColor: '__colors.purpleDark',
    keywordColor: '__colors.purple',
    identifierColor: '__colors.orange',
    stringColor: '__colors.green',
    numberColor: '__colors.pink',
    currentLineBackgroundColor: '__colors.dark',
  },
  table: {
    borderColor: '__colors.border',
    colorHeader: '__colors.white',
    backgroundColorHeader: '__colors.dark',
    backgroundColor: '__colors.darkLightBar',
    backgroundColorRowEven: '__colors.darkLightBar',
    colorRowEven: '__colors.white',
    colorRowOdd: '__colors.white',
    backgroundColorRowOdd: '__colors.dark',
    backgroundColorColumnEdited: '__colors.orange',
    colorColumnEdited: '__colors.darkLightBar',
    selectedColor: '__colors.white',
    selectedBackgroundColor: '__colors.blueTransparent',
    selectedBorderColor: '__colors.blue',
  },
  modal: {
    color: '__colors.white',
    backgroundColor: '__colors.darkLightBar',
    fieldColor: '__colors.white',
    fieldBackgroundColor: '__colors.darkLightDeep',
    fieldLabelColor: '__colors.white',
    saveButtonColor: '__colors.darkLightBar',
    saveButtonBackgroundColor: '__colors.green',
    cancelButtonColor: '__colors.darkLightBar',
    cancelButtonBackgroundColor: '__colors.red',
    testButtonColor: '__colors.darkLightBar',
    testButtonBackgroundColor: '__colors.orange',
  },
  tableInfo: {
    tab: {
      bar: {
        backgroundColor: '__colors.dark',
        borderColor: '__colors.border',
      },
      color: '__colors.white',
      backgroundColor: '__colors.darkLightBar',
      ascentColor: '__colors.purple',
      borderColor: '__colors.border',
    },
    properties: {
      tab: {
        bar: {
          backgroundColor: '__colors.dark',
          borderColor: '__colors.border',
        },
        color: '__colors.white',
        backgroundColor: '__colors.darkLightBar',
        ascentColor: '__colors.orange',
        borderColor: '__colors.border',
      },
      header: {
        backgroundColor: '__colors.darkLightBar',
        fieldColor: '__colors.white',
        fieldBackgroundColor: '__colors.darkLightDeep',
        fieldLabelColor: '__colors.white',
      },
      bar: {
        backgroundColor: '__colors.darkLightDeep',
        color: '__colors.white',
        borderColor: '__colors.border',
      },
    },
    data: {
      bar: {
        color: '__colors.white',
        backgroundColor: '__colors.darkLightDeep',
        fieldColor: '__colors.white',
        fieldBackgroundColor: '__colors.dark',
        borderColor: '__colors.border',
      },
    },
  },
  queryEditor: {
    tab: {
      bar: {
        backgroundColor: '__colors.dark',
        borderColor: '__colors.border',
      },
      color: '__colors.white',
      backgroundColor: '__colors.darkLightBar',
      ascentColor: '__colors.orange',
      borderColor: '__colors.border',
    },
    bar: {
      backgroundColor: '__colors.darkLightDeep',
      fieldColor: '__colors.white',
      color: '__colors.white',
      fieldBackgroundColor: '__colors.dark',
      fieldPlaceholderColor: '__colors.gray',
      borderColor: '__colors.border',
    },
  },
};

const oneLightProThemeOverrides: ThemeOverrides = {
  ...auraLightThemeOverrides,
  sideBar: {
    ...auraLightThemeOverrides.sideBar,
    menuBar: {
      color: '__colors.white',
      backgroundColor: '__colors.dark',
      ascentColor: '__colors.green',
    },
    backgroundColor: '__colors.darkLightBar',
  },
  mainTab: {
    ...auraLightThemeOverrides.mainTab,
    bar: {
      backgroundColor: '__colors.darkLightBar',
      borderColor: '__colors.border',
    },
    backgroundColor: '__colors.dark',
  },
  tableInfo: {
    ...auraLightThemeOverrides.tableInfo,
    properties: {
      ...auraLightThemeOverrides.tableInfo?.properties,
      bar: {
        backgroundColor: '__colors.darkLightBar',
        color: '__colors.white',
        borderColor: '__colors.border',
      },
    },
  },
};

const githubLightThemeOverrides: ThemeOverrides = {
  ...oneLightProThemeOverrides,
  sideBar: {
    ...oneLightProThemeOverrides.sideBar,
    menuBar: {
      color: '__colors.white',
      backgroundColor: '__colors.darkLightBar',
      ascentColor: '__colors.green',
    },
    backgroundColor: '__colors.darkLightBar',
    fieldBackgroundColor: '__colors.darkLightDeep',
  },
  mainTab: {
    ...oneLightProThemeOverrides.mainTab,
    backgroundColor: '__colors.darkLightBar',
  },
  table: {
    ...oneLightProThemeOverrides.table,
    backgroundColorHeader: '__colors.darkLightBar',
    backgroundColor: '__colors.darkLightBar',
    backgroundColorRowEven: '__colors.dark',
    backgroundColorRowOdd: '__colors.darkLightBar',
  },
  tableInfo: {
    ...oneLightProThemeOverrides.tableInfo,
    tab: {
      ...oneLightProThemeOverrides.tableInfo?.tab,
      backgroundColor: '__colors.darkLightBar',
      bar: {
        backgroundColor: '__colors.darkLightBar',
        borderColor: '__colors.border',
      },
    },
    properties: {
      ...oneLightProThemeOverrides.tableInfo?.properties,
      header: {
        backgroundColor: '__colors.darkLightBar',
        fieldColor: '__colors.white',
        fieldBackgroundColor: '__colors.darkLightDeep',
        fieldLabelColor: '__colors.white',
      },
      bar: {
        backgroundColor: '__colors.darkLightDeep',
        color: '__colors.white',
        borderColor: '__colors.border',
      },
    },
  },
};

const catppuccinLatteThemeOverrides: ThemeOverrides = {
  ...auraLightThemeOverrides,
  welcome: {
    color: '__colors.white',
    backgroundColor: '__colors.dark',
  },
  sideBar: {
    ...auraLightThemeOverrides.sideBar,
    menuBar: {
      color: '__colors.white',
      backgroundColor: '__colors.dark',
      ascentColor: '__colors.green',
    },
    backgroundColor: '__colors.darkLightBar',
    fieldBackgroundColor: '__colors.darkLightDeep',
  },
  mainTab: {
    ...auraLightThemeOverrides.mainTab,
    bar: {
      backgroundColor: '__colors.darkLightBar',
      borderColor: '__colors.border',
    },
    backgroundColor: '__colors.dark',
  },
  modal: {
    ...auraLightThemeOverrides.modal,
    backgroundColor: '__colors.darkLightBar',
  },
  table: {
    ...auraLightThemeOverrides.table,
    backgroundColorHeader: '__colors.darkLightBar',
    backgroundColor: '__colors.dark',
    backgroundColorRowEven: '__colors.dark',
    backgroundColorRowOdd: '__colors.darkLightBar',
  },
};

export const builtinThemes = [
  serializeTheme(defaultTheme),
  serializeTheme(createTheme('woodbox-graphite', graphiteColors)),
  serializeTheme(createTheme('woodbox-amber', amberColors)),
  serializeTheme(createTheme('dracula', draculaColors)),
  serializeTheme(createTheme('one-dark-pro', oneDarkProColors)),
  serializeTheme(createTheme('github-dark', githubDarkColors)),
  serializeTheme(createTheme('catppuccin-mocha', catppuccinMochaColors)),
  serializeTheme(createTheme('woodbox-aura-light', auraLightColors, auraLightThemeOverrides)),
  serializeTheme(createTheme('one-light-pro', oneLightProColors, oneLightProThemeOverrides)),
  serializeTheme(createTheme('github-light', githubLightColors, githubLightThemeOverrides)),
  serializeTheme(createTheme('catppuccin-latte', catppuccinLatteColors, catppuccinLatteThemeOverrides)),
];

export const builtinThemeNames = builtinThemes.map((theme) => theme.name);
