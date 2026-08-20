interface ToastAttributesTheme {
  color?: string;
  backgroundColor?: string;
}

interface Toast {
  success?: ToastAttributesTheme;
  warn?: ToastAttributesTheme;
  error?: ToastAttributesTheme;
  shadowColor?: string;
  iconBackgroundColor?: string;
}

interface MenuBar {
  color?: string;
  backgroundColor?: string;
  ascentColor?: string;
}

interface Welcome {
  color?: string;
  backgroundColor?: string;
}

interface SideBar {
  color?: string;
  backgroundColor?: string;
  fieldColor?: string;
  fieldPlaceholderColor?: string;
  fieldBackgroundColor?: string;
  cardBackgroundColor?: string;
  fieldLabelColor?: string;
  menuBar?: MenuBar;
  borderColor?: string;
  borderMutedColor?: string;
  selectedBackgroundColor?: string;
  panelBackgroundColor?: string;
  neutralButtonColor?: string;
  neutralButtonBackgroundColor?: string;
  dangerButtonColor?: string;
  dangerButtonBackgroundColor?: string;
}

interface Editor {
  lineNumberColor?: string;
  currentLineNumberColor?: string;
  cursorColor?: string;
  color?: string;
  backgroundColor?: string;
  currentLineBackgroundColor?: string;
  selectionColor?: string;
  keywordColor?: string;
  identifierColor?: string;
  numberColor?: string;
  delimiterColor?: string;
  stringColor?: string;
}

interface Table {
  borderColor: string;
  backgroundColorHeader: string;
  colorHeader: string;
  backgroundColorRowOdd: string;
  colorRowOdd: string;
  backgroundColorRowEven: string;
  colorRowEven: string;
  backgroundColorColumnEdited: string;
  colorColumnEdited: string;
  backgroundColor: string;
  selectedColor?: string;
  selectedBackgroundColor?: string;
  selectedBorderColor?: string;
  backgroundColorRowNew?: string;
  backgroundColorRowRemoved?: string;
}

interface Modal {
  color?: string;
  backgroundColor?: string;
  fieldColor?: string;
  fieldBackgroundColor?: string;
  fieldLabelColor?: string;
  saveButtonColor?: string;
  saveButtonBackgroundColor?: string;
  cancelButtonColor?: string;
  cancelButtonBackgroundColor?: string;
  testButtonColor?: string;
  testButtonBackgroundColor?: string;
  overlayColor?: string;
  borderColor?: string;
  panelBackgroundColor?: string;
  mutedColor?: string;
  neutralButtonColor?: string;
  neutralButtonBackgroundColor?: string;
  dangerButtonColor?: string;
  dangerButtonBackgroundColor?: string;
}

interface Tab {
  bar?: {
    backgroundColor?: string;
    borderColor?: string;
  };
  color?: string;
  backgroundColor?: string;
  ascentColor?: string;
  borderColor?: string;
  hoverBackgroundColor?: string;
  draggingBackgroundColor?: string;
  editorShadowColor?: string;
  groupColors?: string[];
}

interface TableInfo {
  tab?: Tab;

  properties?: {
    tab?: Tab;
    header?: Header;
    bar: {
      backgroundColor?: string;
      color?: string;
      borderColor?: string;
    };
  };

  data?: {
    bar?: {
      backgroundColor?: string;
      color?: string;
      fieldBackgroundColor?: string;
      fieldColor?: string;
      fieldPlaceholderColor?: string;
      borderColor?: string;
    };
  };
}

interface QueryEditor {
  tab?: {
    bar?: {
      backgroundColor?: string;
      borderColor?: string;
    };
    color?: string;
    backgroundColor?: string;
    ascentColor?: string;
    borderColor?: string;
  };

  bar?: {
    backgroundColor?: string;
    color?: string;
    fieldColor?: string;
    fieldBackgroundColor?: string;
    fieldPlaceholderColor?: string;
    borderColor?: string;
  };

  error?: {
    borderColor?: string;
    accentColor?: string;
    backgroundColor?: string;
    messageBackgroundColor?: string;
    messageColor?: string;
    mutedColor?: string;
  };

  explain?: {
    mutedColor?: string;
    surfaceColor?: string;
    warnColor?: string;
    dangerColor?: string;
  };

  serverOutput?: {
    backgroundColor?: string;
  };

  capture?: {
    activeColor?: string;
    modifiedColor?: string;
  };
}

interface Header {
  backgroundColor?: string;
  fieldColor?: string;
  fieldBackgroundColor?: string;
  fieldLabelColor?: string;
}

interface ContextMenu {
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
}

interface ButtonTheme {
  hoverBackgroundColor?: string;
  activeColor?: string;
}

interface AutocompleteTheme {
  backgroundColor?: string;
  hoverBackgroundColor?: string;
  selectedBackgroundColor?: string;
  activeBackgroundColor?: string;
  borderColor?: string;
  shadowColor?: string;
  blank?: {
    hoverBackgroundColor?: string;
    selectedBackgroundColor?: string;
    activeBackgroundColor?: string;
    borderColor?: string;
    shadowColor?: string;
  };
}

interface FieldTheme {
  requiredColor?: string;
  borderColor?: string;
  mutedColor?: string;
}

interface LoadersTheme {
  overlayBackgroundColor?: string;
  spinnerBackgroundColor?: string;
  barColors?: string[];
}

interface SettingsTheme {
  menuBackgroundColor?: string;
  menuHoverBackgroundColor?: string;
  inactiveMenuColor?: string;
  mutedColor?: string;
  optionHoverBackgroundColor?: string;
  themeBorderColor?: string;
  themePanelBackgroundColor?: string;
  themeHoverBackgroundColor?: string;
  importBorderColor?: string;
  importBackgroundColor?: string;
  importMutedColor?: string;
  importWarningColor?: string;
}

interface CentralSearchTheme {
  overlayColor?: string;
  borderColor?: string;
  shadowColor?: string;
  subtleBackgroundColor?: string;
  hoverBackgroundColor?: string;
  mutedColor?: string;
  dropdownBorderColor?: string;
}

interface AIChatTheme {
  cardBackgroundColor?: string;
  mutedColor?: string;
  sendBackgroundColor?: string;
  sendColor?: string;
  sendDisabledBackgroundColor?: string;
  sendDisabledColor?: string;
  queryPendingColor?: string;
  queryApprovedColor?: string;
  queryRejectedColor?: string;
  dropdownBackgroundColor?: string;
  neutralButtonColor?: string;
  neutralButtonBackgroundColor?: string;
  dangerButtonColor?: string;
  dangerButtonBackgroundColor?: string;
}

interface FeedbackTheme {
  errorBorderColor?: string;
  errorAccentColor?: string;
  errorBackgroundColor?: string;
  errorMessageBackgroundColor?: string;
  warningBorderColor?: string;
  warningBackgroundColor?: string;
}

export interface ITheme {
  name: string;

  welcome?: Welcome;
  toast?: Toast;
  sideBar?: SideBar;
  editor?: Editor;
  table?: Table;
  modal?: Modal;
  mainTab?: Tab;
  tableInfo?: TableInfo;
  queryEditor?: QueryEditor;
  contextMenu?: ContextMenu;
  button?: ButtonTheme;
  autocomplete?: AutocompleteTheme;
  field?: FieldTheme;
  loaders?: LoadersTheme;
  settings?: SettingsTheme;
  centralSearch?: CentralSearchTheme;
  aiChat?: AIChatTheme;
  feedback?: FeedbackTheme;
}
