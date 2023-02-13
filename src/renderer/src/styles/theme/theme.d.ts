interface ToastAttributesTheme<Colors> {
  color?: Colors;
  backgroundColor?: Colors;
}

interface Toast<Colors> {
  success?: ToastAttributesTheme<Colors>;
  warn?: ToastAttributesTheme<Colors>;
  error?: ToastAttributesTheme<Colors>;
}

interface MenuBar<Colors> {
  color?: Colors;
  backgroundColor?: Colors;
  ascentColor?: Colors;
}

interface SideBar<Colors> {
  color?: Colors;
  backgroundColor?: Colors;
  fieldColor?: Colors;
  fieldPlaceholderColor?: Colors;
  fieldBackgroundColor?: Colors;
  fieldLabelColor?: Colors;
  menuBar?: MenuBar<Colors>;
}

interface Editor<Colors> {
  lineNumberColor?: Colors;
  currentLineNumberColor?: Colors;
  cursorColor?: Colors;
  color?: Colors;
  backgroundColor?: Colors;
  currentLineBackgroundColor?: Colors;
  selectionColor?: Colors;
  keywordColor?: Colors;
  identifierColor?: Colors;
  ColorsColor?: Colors;
  numberColor?: Colors;
  delimiterColor?: Colors;
  stringColor?: Colors;
}

interface Table<Colors> {
  backgroundColor?: Colors;
  headerBackgroundColor?: Colors;
  headerColor?: Colors;
  headerSeparatorColor?: Colors;
  rowBackgroundColor?: Colors;
  rowOddBackgroundColor?: Colors;
  rowColor?: Colors;
  rowSeparatorColor?: Colors;
}

interface Modal<Colors> {
  backgroundColor?: Colors;
  fieldColor?: Colors;
  fieldBackgroundColor?: Colors;
  fieldLabelColor?: Colors;
  saveButtonColor?: Colors;
  saveButtonBackgroundColor?: Colors;
  cancelButtonColor?: Colors;
  cancelButtonBackgroundColor?: Colors;
  testButtonColor?: Colors;
  testButtonBackgroundColor?: Colors;
}

interface Tab<Colors> {
  bar?: {
    backgroundColor?: Colors;
  };
  color?: Colors;
  backgroundColor?: Colors;
  ascentColor?: Colors;
}

interface TableInfo<Colors> {
  tab?: Tab<Colors>;

  properties?: {
    tab?: Tab<Colors>;
    header?: Header<Colors>;
    bar: {
      backgroundColor?: Colors;
      color?: Colors;
    };
  };

  data?: {
    bar?: {
      backgroundColor?: Colors;
      color?: Colors;
      fieldBackgroundColor?: Colors;
      fieldColor?: Colors;
      fieldPlaceholderColor?: Colors;
    };
  };
}

interface QueryEditor<Colors> {
  tab?: {
    bar?: {
      backgroundColor?: Colors;
    };
    color?: Colors;
    backgroundColor?: Colors;
    ascentColor?: Colors;
  };

  bar?: {
    backgroundColor?: Colors;
    color?: Colors;
    fieldColor?: Colors;
    fieldBackgroundColor?: Colors;
    fieldPlaceholderColor?: Colors;
  };
}

interface Header<Colors> {
  backgroundColor?: Colors;
  fieldColor?: Colors;
  fieldBackgroundColor?: Colors;
  fieldLabelColor?: Colors;
}

interface ContextMenu<Colors> {
  color?: Colors;
  backgroundColor?: Colors;
  borderColor?: Colors;
}

export interface ITheme<Colors = unknown> {
  name: string;

  __colors?: {
    [key: string]: string;
  };

  toast?: Toast<Colors>;
  sideBar?: SideBar<Colors>;
  editor?: Editor<Colors>;
  table?: Table<Colors>;
  modal?: Modal<Colors>;
  mainTab?: Tab<Colors>;
  tableInfo?: TableInfo<Colors>;
  queryEditor?: QueryEditor<Colors>;
  contextMenu?: ContextMenu<Colors>;
}
