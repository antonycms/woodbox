import type { ITheme } from './theme';

const __colors = {
  purple: '#a277ff',
  purpleDark: '#3d375e7f',
  blueTransparent: '#72a1ff59',
  green: '#61ffca',
  greenDeep: '#54C59F',
  orange: '#ffca85',
  orangeDeep: '#E79E3F',
  greenTransparent: '#aafe661a',
  pink: '#f694ff',
  blue: '#82e2ff',
  red: '#ff6767',
  redDeep: '#E73C3C',
  white: '#edecee',
  gray: '#6d6d6d',
  lightGray: '#3838387f',
  dark: '#1c1b22',
  darkLight: '#44475a3d',
  darkLightBar: '#1f1f26',
  darkLightDeep: '#242329',
  backgroundContextMenu: '#1b1727',
  border: '#191622',
  transparent: 'transparent',
};

type Color = `__colors.${keyof typeof __colors}`;

const defaultTheme: ITheme<Color> = {
  name: 'default-theme',

  __colors,

  welcome: {
    color: '__colors.white',
    backgroundColor: '__colors.dark',
  },

  sideBar: {
    menuBar: {
      color: '__colors.white',
      backgroundColor: '__colors.dark',
      ascentColor: '__colors.green',
    },
    color: '__colors.white',
    backgroundColor: '__colors.dark',
    fieldColor: '__colors.white',
    fieldPlaceholderColor: '__colors.white',
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
    backgroundColor: '__colors.dark',
    ascentColor: '__colors.green',
    borderColor: '__colors.border',
  },

  toast: {
    success: {
      color: '__colors.white',
      backgroundColor: '__colors.greenDeep',
    },
    warn: {
      color: '__colors.white',
      backgroundColor: '__colors.orangeDeep',
    },
    error: {
      color: '__colors.white',
      backgroundColor: '__colors.redDeep',
    },
  },

  contextMenu: {
    color: '__colors.white',
    backgroundColor: '__colors.backgroundContextMenu',
    borderColor: '__colors.dark',
  },

  editor: {
    lineNumberColor: '__colors.gray',
    currentLineNumberColor: '__colors.white',
    cursorColor: '__colors.white',
    color: '__colors.white',
    backgroundColor: '__colors.dark',
    selectionColor: '__colors.purpleDark',
    keywordColor: '__colors.purple',
    identifierColor: '__colors.orange',
    stringColor: '__colors.green',
    numberColor: '__colors.pink',
    // delimiterColor: '',
    currentLineBackgroundColor: '__colors.darkLight',
  },

  table: {
    borderColor: '__colors.lightGray',
    colorHeader: '__colors.white',
    backgroundColorHeader: '__colors.dark',
    backgroundColor: '__colors.dark',
    backgroundColorRowEven: '__colors.dark',
    colorRowEven: '__colors.white',
    colorRowOdd: '__colors.white',
    backgroundColorRowOdd: '__colors.darkLightDeep',
    backgroundColorColumnEdited: '__colors.orange',
    colorColumnEdited: '__colors.dark',
  },

  modal: {
    color: '__colors.white',
    backgroundColor: '__colors.dark',
    fieldColor: '__colors.white',
    fieldBackgroundColor: '__colors.darkLightDeep',
    fieldLabelColor: '__colors.white',
    saveButtonColor: '__colors.dark',
    saveButtonBackgroundColor: '__colors.green',
    cancelButtonColor: '__colors.dark',
    cancelButtonBackgroundColor: '__colors.red',
    testButtonColor: '__colors.dark',
    testButtonBackgroundColor: '__colors.orange',
  },

  // views

  tableInfo: {
    tab: {
      bar: {
        backgroundColor: '__colors.dark',
        borderColor: '__colors.border',
      },
      color: '__colors.white',
      backgroundColor: '__colors.dark',
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
        backgroundColor: '__colors.dark',
        ascentColor: '__colors.orange',
        borderColor: '__colors.border',
      },

      header: {
        backgroundColor: '__colors.dark',
        fieldColor: '__colors.white',
        fieldBackgroundColor: '__colors.darkLightDeep',
        fieldLabelColor: '__colors.white',
      },

      bar: {
        backgroundColor: '__colors.dark',
        color: '__colors.white',
        borderColor: '__colors.border',
      },
    },

    data: {
      bar: {
        color: '__colors.white',
        backgroundColor: '__colors.darkLightBar',
        fieldColor: '__colors.white',
        fieldBackgroundColor: '__colors.darkLightDeep',
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
      backgroundColor: '__colors.dark',
      ascentColor: '__colors.orange',
      borderColor: '__colors.border',
    },

    bar: {
      backgroundColor: '__colors.darkLightBar',
      fieldColor: '__colors.white',
      color: '__colors.white',
      fieldBackgroundColor: '__colors.darkLightDeep',
      fieldPlaceholderColor: '__colors.white',
      borderColor: '__colors.border',
    },
  },
};

export default defaultTheme;
