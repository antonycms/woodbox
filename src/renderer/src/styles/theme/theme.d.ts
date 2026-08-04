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

interface Welcome<Colors> {
  color?: Colors;
  backgroundColor?: Colors;
}

interface SideBar<Colors> {
  color?: Colors;
  backgroundColor?: Colors;
  fieldColor?: Colors;
  fieldPlaceholderColor?: Colors;
  fieldBackgroundColor?: Colors;
  cardBackgroundColor?: Colors;
  fieldLabelColor?: Colors;
  menuBar?: MenuBar<Colors>;
  borderColor?: Colors;
  selectedBackgroundColor?: Colors;
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
  numberColor?: Colors;
  delimiterColor?: Colors;
  stringColor?: Colors;
}

interface Table<Colors> {
  borderColor: Colors;
  backgroundColorHeader: Colors;
  colorHeader: Colors;
  backgroundColorRowOdd: Colors;
  colorRowOdd: Colors;
  backgroundColorRowEven: Colors;
  colorRowEven: Colors;
  backgroundColorColumnEdited: Colors;
  colorColumnEdited: Colors;
  backgroundColor: Colors;
  selectedColor?: Colors;
  selectedBackgroundColor?: Colors;
  selectedBorderColor?: Colors;
}

interface Modal<Colors> {
  color?: Colors;
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
    borderColor?: Colors;
  };
  color?: Colors;
  backgroundColor?: Colors;
  ascentColor?: Colors;
  borderColor?: Colors;
}

interface TableInfo<Colors> {
  tab?: Tab<Colors>;

  properties?: {
    tab?: Tab<Colors>;
    header?: Header<Colors>;
    bar: {
      backgroundColor?: Colors;
      color?: Colors;
      borderColor?: Colors;
    };
  };

  data?: {
    bar?: {
      backgroundColor?: Colors;
      color?: Colors;
      fieldBackgroundColor?: Colors;
      fieldColor?: Colors;
      fieldPlaceholderColor?: Colors;
      borderColor?: Colors;
    };
  };
}

interface QueryEditor<Colors> {
  tab?: {
    bar?: {
      backgroundColor?: Colors;
      borderColor?: Colors;
    };
    color?: Colors;
    backgroundColor?: Colors;
    ascentColor?: Colors;
    borderColor?: Colors;
  };

  bar?: {
    backgroundColor?: Colors;
    color?: Colors;
    fieldColor?: Colors;
    fieldBackgroundColor?: Colors;
    fieldPlaceholderColor?: Colors;
    borderColor?: Colors;
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

  welcome?: Welcome<Colors>;
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
