import React from 'react';
import { Autocomplete } from '@renderer/components/Autocomplete';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Text } from '@renderer/components/Text';
import {
  useI18n,
  type TranslateFn,
  type TranslateTextFn,
  type TranslationKey,
} from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { useToast } from '@renderer/contexts/Toast';
import useDebounce from '@renderer/hooks/useDebounce';
import type { ITheme } from '@renderer/styles/theme';
import { builtinThemeNames } from '@renderer/styles/theme/builtin';
import { CancelIcon, ExportIcon, ImportIcon, RemoveIcon, SaveIcon } from '@renderer/styles/icons';
import styles from './styles.module.css';

const currentCustomThemeName = 'Personalizado atual';
const defaultThemeName = 'default-theme';

interface IAdvancedThemeField {
  path: string;
  label: string;
  value: string;
}

const themeGroupLabelKeys: Record<string, TranslationKey> = {
  welcome: 'settings.customization.group.welcome',
  sideBar: 'settings.customization.group.sideBar',
  mainTab: 'settings.customization.group.mainTab',
  toast: 'settings.customization.group.toast',
  contextMenu: 'settings.customization.group.contextMenu',
  editor: 'settings.customization.group.editor',
  table: 'settings.customization.group.table',
  modal: 'settings.customization.group.modal',
  tableInfo: 'settings.customization.group.tableInfo',
  queryEditor: 'settings.customization.group.queryEditor',
  button: 'settings.customization.group.button',
  autocomplete: 'settings.customization.group.autocomplete',
  field: 'settings.customization.group.field',
  loaders: 'settings.customization.group.loaders',
  settings: 'settings.customization.group.settings',
  centralSearch: 'settings.customization.group.centralSearch',
  aiChat: 'settings.customization.group.aiChat',
  feedback: 'settings.customization.group.feedback',
};

const themePathLabelKeys: Record<string, TranslationKey> = {
  menuBar: 'settings.customization.path.menuBar',
  bar: 'settings.customization.path.bar',
  success: 'settings.customization.path.success',
  warn: 'settings.customization.path.warn',
  error: 'settings.customization.path.error',
  blank: 'settings.customization.path.blank',
  tab: 'settings.customization.path.tab',
  properties: 'settings.customization.path.properties',
  header: 'settings.customization.path.header',
  data: 'settings.customization.path.data',
  explain: 'settings.customization.path.explain',
  serverOutput: 'settings.customization.path.serverOutput',
  capture: 'settings.customization.path.capture',
  groupColors: 'settings.customization.path.groupColors',
  barColors: 'settings.customization.path.barColors',
};

const themeAttributeLabelKeys: Record<string, TranslationKey> = {
  color: 'settings.customization.attribute.color',
  backgroundColor: 'settings.customization.attribute.backgroundColor',
  fieldColor: 'settings.customization.attribute.fieldColor',
  fieldPlaceholderColor: 'settings.customization.attribute.fieldPlaceholderColor',
  fieldBackgroundColor: 'settings.customization.attribute.fieldBackgroundColor',
  cardBackgroundColor: 'settings.customization.attribute.cardBackgroundColor',
  fieldLabelColor: 'settings.customization.attribute.fieldLabelColor',
  borderColor: 'settings.customization.attribute.borderColor',
  borderMutedColor: 'settings.customization.attribute.borderMutedColor',
  ascentColor: 'settings.customization.attribute.ascentColor',
  saveButtonColor: 'settings.customization.attribute.saveButtonColor',
  saveButtonBackgroundColor: 'settings.customization.attribute.saveButtonBackgroundColor',
  cancelButtonColor: 'settings.customization.attribute.cancelButtonColor',
  cancelButtonBackgroundColor: 'settings.customization.attribute.cancelButtonBackgroundColor',
  testButtonColor: 'settings.customization.attribute.testButtonColor',
  testButtonBackgroundColor: 'settings.customization.attribute.testButtonBackgroundColor',
  neutralButtonColor: 'settings.customization.attribute.neutralButtonColor',
  neutralButtonBackgroundColor: 'settings.customization.attribute.neutralButtonBackgroundColor',
  dangerButtonColor: 'settings.customization.attribute.dangerButtonColor',
  dangerButtonBackgroundColor: 'settings.customization.attribute.dangerButtonBackgroundColor',
  lineNumberColor: 'settings.customization.attribute.lineNumberColor',
  currentLineNumberColor: 'settings.customization.attribute.currentLineNumberColor',
  cursorColor: 'settings.customization.attribute.cursorColor',
  currentLineBackgroundColor: 'settings.customization.attribute.currentLineBackgroundColor',
  selectionColor: 'settings.customization.attribute.selectionColor',
  keywordColor: 'settings.customization.attribute.keywordColor',
  identifierColor: 'settings.customization.attribute.identifierColor',
  numberColor: 'settings.customization.attribute.numberColor',
  delimiterColor: 'settings.customization.attribute.delimiterColor',
  stringColor: 'settings.customization.attribute.stringColor',
  colorHeader: 'settings.customization.attribute.colorHeader',
  backgroundColorHeader: 'settings.customization.attribute.backgroundColorHeader',
  backgroundColorRowOdd: 'settings.customization.attribute.backgroundColorRowOdd',
  colorRowOdd: 'settings.customization.attribute.colorRowOdd',
  backgroundColorRowEven: 'settings.customization.attribute.backgroundColorRowEven',
  colorRowEven: 'settings.customization.attribute.colorRowEven',
  backgroundColorColumnEdited: 'settings.customization.attribute.backgroundColorColumnEdited',
  colorColumnEdited: 'settings.customization.attribute.colorColumnEdited',
  selectedColor: 'settings.customization.attribute.selectedColor',
  selectedBackgroundColor: 'settings.customization.attribute.selectedBackgroundColor',
  selectedBorderColor: 'settings.customization.attribute.selectedBorderColor',
  backgroundColorRowNew: 'settings.customization.attribute.backgroundColorRowNew',
  backgroundColorRowRemoved: 'settings.customization.attribute.backgroundColorRowRemoved',
  panelBackgroundColor: 'settings.customization.attribute.panelBackgroundColor',
  overlayColor: 'settings.customization.attribute.overlayColor',
  shadowColor: 'settings.customization.attribute.shadowColor',
  iconBackgroundColor: 'settings.customization.attribute.iconBackgroundColor',
  hoverBackgroundColor: 'settings.customization.attribute.hoverBackgroundColor',
  activeColor: 'settings.customization.attribute.activeColor',
  activeBackgroundColor: 'settings.customization.attribute.activeBackgroundColor',
  draggingBackgroundColor: 'settings.customization.attribute.draggingBackgroundColor',
  editorShadowColor: 'settings.customization.attribute.editorShadowColor',
  requiredColor: 'settings.customization.attribute.requiredColor',
  mutedColor: 'settings.customization.attribute.mutedColor',
  overlayBackgroundColor: 'settings.customization.attribute.overlayBackgroundColor',
  spinnerBackgroundColor: 'settings.customization.attribute.spinnerBackgroundColor',
  menuBackgroundColor: 'settings.customization.attribute.menuBackgroundColor',
  menuHoverBackgroundColor: 'settings.customization.attribute.menuHoverBackgroundColor',
  inactiveMenuColor: 'settings.customization.attribute.inactiveMenuColor',
  optionHoverBackgroundColor: 'settings.customization.attribute.optionHoverBackgroundColor',
  themeBorderColor: 'settings.customization.attribute.themeBorderColor',
  themePanelBackgroundColor: 'settings.customization.attribute.themePanelBackgroundColor',
  themeHoverBackgroundColor: 'settings.customization.attribute.themeHoverBackgroundColor',
  importBorderColor: 'settings.customization.attribute.importBorderColor',
  importBackgroundColor: 'settings.customization.attribute.importBackgroundColor',
  importMutedColor: 'settings.customization.attribute.importMutedColor',
  importWarningColor: 'settings.customization.attribute.importWarningColor',
  subtleBackgroundColor: 'settings.customization.attribute.subtleBackgroundColor',
  dropdownBorderColor: 'settings.customization.attribute.dropdownBorderColor',
  sendBackgroundColor: 'settings.customization.attribute.sendBackgroundColor',
  sendColor: 'settings.customization.attribute.sendColor',
  sendDisabledBackgroundColor: 'settings.customization.attribute.sendDisabledBackgroundColor',
  sendDisabledColor: 'settings.customization.attribute.sendDisabledColor',
  queryPendingColor: 'settings.customization.attribute.queryPendingColor',
  queryApprovedColor: 'settings.customization.attribute.queryApprovedColor',
  queryRejectedColor: 'settings.customization.attribute.queryRejectedColor',
  dropdownBackgroundColor: 'settings.customization.attribute.dropdownBackgroundColor',
  errorBorderColor: 'settings.customization.attribute.errorBorderColor',
  errorAccentColor: 'settings.customization.attribute.errorAccentColor',
  errorBackgroundColor: 'settings.customization.attribute.errorBackgroundColor',
  errorMessageBackgroundColor: 'settings.customization.attribute.errorMessageBackgroundColor',
  warningBorderColor: 'settings.customization.attribute.warningBorderColor',
  warningBackgroundColor: 'settings.customization.attribute.warningBackgroundColor',
  accentColor: 'settings.customization.attribute.accentColor',
  messageBackgroundColor: 'settings.customization.attribute.messageBackgroundColor',
  messageColor: 'settings.customization.attribute.messageColor',
  surfaceColor: 'settings.customization.attribute.surfaceColor',
  warnColor: 'settings.customization.attribute.warnColor',
  dangerColor: 'settings.customization.attribute.dangerColor',
  modifiedColor: 'settings.customization.attribute.modifiedColor',
};

const themeLabels = {
  'woodbox-graphite': 'Grafite',
  'woodbox-amber': 'Âmbar',
  dracula: 'Dracula',
  'one-dark-pro': 'One Dark Pro',
  'github-dark': 'GitHub Dark',
  'catppuccin-mocha': 'Catppuccin Mocha',
  omni: 'Omni',
  'woodbox-aura-light': 'Aura Light',
  'one-light-pro': 'One Light Pro',
  'github-light': 'GitHub Light',
  'catppuccin-latte': 'Catppuccin Latte',
};

const getThemeLabel = (theme: ITheme, t: TranslateFn, tText: TranslateTextFn) => {
  if (theme.name === currentCustomThemeName) return t('settings.customization.currentCustomTheme');
  if (theme.name === defaultThemeName) return t('settings.customization.defaultThemeLabel');

  return tText(themeLabels[theme.name]) || theme.name;
};

const isTheme = (value: unknown): value is ITheme => {
  return !!value && typeof value === 'object' && typeof (value as ITheme).name === 'string';
};

const normalizeFileName = (value: string) => {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
};

const isNativeColorValue = (value: string) => /^#[0-9a-fA-F]{6}([0-9a-fA-F]{2})?$/.test(value);

const getNativeColorValue = (value: string) => value.slice(0, 7);

const getColorInputValue = (value: string, currentValue: string) => {
  const alpha = currentValue.length === 9 ? currentValue.slice(7) : '';

  return `${value}${alpha}`;
};

const cloneWithPathValue = (theme: ITheme, path: string, value: string): ITheme => {
  const clonedTheme = JSON.parse(JSON.stringify(theme));
  const keys = path.split('.');
  const lastKey = keys.pop();
  let target = clonedTheme as Record<string, unknown>;

  for (const key of keys) {
    target = target[key] as Record<string, unknown>;
  }

  if (lastKey) {
    target[lastKey] = value;
  }

  return clonedTheme;
};

const formatPathPart = (value: string) => {
  return value
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (letter) => letter.toUpperCase())
    .trim();
};

const translatePathPart = (value: string, t: TranslateFn) => {
  const labelKey = themePathLabelKeys[value];

  return labelKey ? t(labelKey) : formatPathPart(value);
};

const getThemeFieldLabel = (fieldName: string, parentName: string | undefined, t: TranslateFn) => {
  if (/^\d+$/.test(fieldName)) {
    const index = Number(fieldName) + 1;

    if (parentName === 'groupColors') {
      return t('settings.customization.attribute.groupColor', { index });
    }

    if (parentName === 'barColors') {
      return t('settings.customization.attribute.barColor', { index });
    }

    return t('settings.customization.attribute.colorIndex', { index });
  }

  const labelKey = themeAttributeLabelKeys[fieldName];

  return labelKey ? t(labelKey) : formatPathPart(fieldName);
};

const getAdvancedThemeFields = (theme: ITheme, t: TranslateFn) => {
  const groups = new Map<string, IAdvancedThemeField[]>();

  const walk = (target: unknown, path: string[] = []) => {
    if (!target || typeof target !== 'object') return;

    const themePart = target as Record<string, unknown>;

    for (const key in themePart) {
      if (key === 'name') continue;

      const value = themePart[key];
      const nextPath = [...path, key];

      if (value && typeof value === 'object') {
        walk(value, nextPath);
        continue;
      }

      if (typeof value !== 'string') continue;

      const groupName = nextPath[0];
      const groupFields = groups.get(groupName) || [];
      const fieldName = nextPath[nextPath.length - 1];
      const parentName = nextPath[nextPath.length - 2];
      const parentPath = nextPath
        .slice(1, -1)
        .map((pathPart) => translatePathPart(pathPart, t))
        .join(' / ');
      const label = getThemeFieldLabel(fieldName, parentName, t);

      groupFields.push({
        path: nextPath.join('.'),
        label: parentPath ? `${parentPath} / ${label}` : label,
        value,
      });
      groups.set(groupName, groupFields);
    }
  };

  walk(theme);

  return [...groups.entries()].map(([name, fields]) => ({
    name,
    label: themeGroupLabelKeys[name] ? t(themeGroupLabelKeys[name]) : formatPathPart(name),
    fields,
  }));
};

export const SettingsCustomizationPanel = React.memo(() => {
  const { activeTheme, availableThemes, addTheme, removeTheme, changeTheme } = useThemeContext();
  const { showToast } = useToast();
  const { t, tText } = useI18n();
  const inputFileRef = React.useRef<HTMLInputElement>(null);
  const saveNameInputRef = React.useRef<HTMLInputElement>(null);
  const baseThemeNameRef = React.useRef(
    activeTheme.name === currentCustomThemeName ? defaultThemeName : activeTheme.name,
  );

  const [themeName, setThemeName] = React.useState('');
  const [inputsVersion, setInputsVersion] = React.useState(0);
  const [showSaveNameInput, setShowSaveNameInput] = React.useState(false);
  const [themeToRemove, setThemeToRemove] = React.useState<string>();

  const { modal: colors, settings } = activeTheme;

  const advancedGroups = React.useMemo(() => {
    return getAdvancedThemeFields(activeTheme, t);
  }, [activeTheme, t]);
  const panelStyle = React.useMemo(
    () =>
      ({
        '--settings-option-hover-background-color': settings.optionHoverBackgroundColor,
      }) as React.CSSProperties,
    [settings.optionHoverBackgroundColor],
  );

  const isCurrentCustomTheme = activeTheme.name === currentCustomThemeName;
  const canRemoveThemeName = React.useCallback((themeName: string) => {
    return !builtinThemeNames.includes(themeName) && themeName !== currentCustomThemeName;
  }, []);
  const canSaveCurrentTheme = isCurrentCustomTheme;
  const canDiscardCurrentChanges = isCurrentCustomTheme;
  const canRemoveActiveTheme = canRemoveThemeName(activeTheme.name);

  const handleChangeTheme = React.useCallback(
    (themeNameSelected: string) => {
      changeTheme(themeNameSelected);
      baseThemeNameRef.current = themeNameSelected;
      setThemeName('');
      setShowSaveNameInput(false);
      setInputsVersion((value) => value + 1);
    },
    [changeTheme],
  );

  const applyAdvancedColorChange = useDebounce((path: string, value: string) => {
    const nextTheme = cloneWithPathValue(activeTheme, path, value);

    addTheme(
      {
        ...nextTheme,
        name: currentCustomThemeName,
      },
      { activate: true },
    );
  }, 250);

  const handleChangeAdvancedColor = React.useCallback(
    (path: string, value: string) => {
      applyAdvancedColorChange(path, value);
    },
    [applyAdvancedColorChange],
  );

  const handleSaveAsTheme = React.useCallback(() => {
    const nextThemeName = themeName.trim();

    if (!nextThemeName) {
      showToast({
        type: 'warn',
        title: t('settings.customization.themeNameRequiredTitle'),
        description: t('settings.customization.themeNameRequiredDescription'),
      });
      return;
    }

    if (builtinThemeNames.includes(nextThemeName)) {
      showToast({
        type: 'warn',
        title: t('settings.customization.reservedNameTitle'),
        description: t('settings.customization.reservedNameDescription'),
      });
      return;
    }

    addTheme(
      {
        ...activeTheme,
        name: nextThemeName,
      },
      { activate: true },
    );

    setThemeName('');
    setShowSaveNameInput(false);
    baseThemeNameRef.current = nextThemeName;
    showToast({
      type: 'success',
      title: t('settings.customization.themeSavedTitle'),
      description: t('settings.customization.themeSavedDescription', { themeName: nextThemeName }),
    });
  }, [activeTheme, addTheme, showToast, t, themeName]);

  const handleClickSaveAsTheme = React.useCallback(() => {
    if (!showSaveNameInput) {
      setShowSaveNameInput(true);
      return;
    }

    handleSaveAsTheme();
  }, [handleSaveAsTheme, showSaveNameInput]);

  const handleDiscardCurrentChanges = React.useCallback(() => {
    removeTheme(currentCustomThemeName, baseThemeNameRef.current);
    setShowSaveNameInput(false);
    setInputsVersion((value) => value + 1);
    showToast({
      type: 'success',
      title: t('settings.customization.changesDiscardedTitle'),
      description: t('settings.customization.changesDiscardedDescription'),
    });
  }, [removeTheme, showToast, t]);

  const requestRemoveTheme = React.useCallback(
    (themeNameToRemove: string) => {
      if (!canRemoveThemeName(themeNameToRemove)) return;
      setThemeToRemove(themeNameToRemove);
    },
    [canRemoveThemeName],
  );

  const confirmRemoveTheme = React.useCallback(() => {
    if (!themeToRemove) return;

    const fallbackThemeName =
      themeToRemove === activeTheme.name ? defaultThemeName : activeTheme.name;

    removeTheme(themeToRemove, fallbackThemeName);
    baseThemeNameRef.current = fallbackThemeName;
    setThemeToRemove(undefined);
    setShowSaveNameInput(false);
    setInputsVersion((value) => value + 1);
    showToast({
      type: 'success',
      title: t('settings.customization.themeRemovedTitle'),
      description: t('settings.customization.themeRemovedDescription', {
        themeName: themeToRemove,
      }),
    });
  }, [activeTheme.name, removeTheme, showToast, t, themeToRemove]);

  const handleRemoveActiveTheme = React.useCallback(() => {
    requestRemoveTheme(activeTheme.name);
  }, [activeTheme.name, requestRemoveTheme]);

  const handleExportTheme = React.useCallback(() => {
    const blob = new Blob([JSON.stringify(activeTheme, null, 2)], {
      type: 'application/json',
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');

    link.href = url;
    link.download = `${normalizeFileName(activeTheme.name) || 'tema-woodbox'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  }, [activeTheme]);

  const handleImportTheme = React.useCallback(
    async (event: React.ChangeEvent<HTMLInputElement>) => {
      const file = event.target.files?.[0];
      event.target.value = '';

      if (!file) return;

      try {
        const importedTheme = JSON.parse(await file.text());

        if (!isTheme(importedTheme)) {
          throw new Error(t('settings.customization.invalidThemeFile'));
        }

        addTheme(importedTheme, { activate: true });
        baseThemeNameRef.current = importedTheme.name;
        setShowSaveNameInput(false);
        setInputsVersion((value) => value + 1);
        showToast({
          type: 'success',
          title: t('settings.customization.themeImportedTitle'),
          description: t('settings.customization.themeImportedDescription', {
            themeName: importedTheme.name,
          }),
        });
      } catch (error) {
        showToast({
          type: 'error',
          title: t('settings.customization.themeImportFailedTitle'),
          description: error.message,
        });
      }
    },
    [addTheme, showToast, t],
  );

  React.useEffect(() => {
    if (activeTheme.name !== currentCustomThemeName) {
      baseThemeNameRef.current = activeTheme.name;
    }
  }, [activeTheme.name]);

  React.useEffect(() => {
    if (showSaveNameInput) {
      saveNameInputRef.current?.focus();
    }
  }, [showSaveNameInput]);

  return (
    <div className={styles.panel} style={panelStyle}>
      <div className={styles.scrollContent}>
        <Text bold color={colors.color} userSelect={false}>
          {t('settings.customization.title')}
        </Text>

        <Divider size={8} />

        <Row>
          <Autocomplete
            required
            clearable={false}
            data={availableThemes}
            label={t('settings.customization.activeTheme')}
            value={activeTheme.name}
            extractLabel={(theme) => getThemeLabel(theme, t, tText)}
            extractValue={(theme) => theme.name}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            xs={12}
            onChange={(event) => handleChangeTheme(String(event.value))}
            renderOptionActions={(theme) =>
              canRemoveThemeName(theme.name) && (
                <button
                  type="button"
                  title={t('settings.customization.removeThemeTitle')}
                  className={styles.optionRemoveButton}
                  onClick={(event) => {
                    event.stopPropagation();
                    requestRemoveTheme(theme.name);
                  }}
                  style={{ color: colors.cancelButtonBackgroundColor }}
                >
                  <RemoveIcon size={13} />
                </button>
              )
            }
          />
        </Row>

        <Divider size={12} />

        <Text small color={settings.mutedColor} userSelect={false}>
          {t('settings.customization.currentCustomHelp', {
            themeName: t('settings.customization.currentCustomTheme'),
          })}
        </Text>

        <Divider size={10} />

        <div
          className={styles.advancedGroups}
          style={
            {
              '--theme-border-color': settings.themeBorderColor,
              '--theme-panel-background-color': settings.themePanelBackgroundColor,
              '--theme-hover-background-color': settings.themeHoverBackgroundColor,
              '--theme-muted-color': settings.mutedColor,
            } as React.CSSProperties
          }
        >
          {advancedGroups.map((group) => (
            <details key={group.name} className={styles.advancedGroup}>
              <summary className={styles.advancedGroupHeader}>
                <span className={styles.advancedGroupTitle} style={{ color: colors.color }}>
                  {group.label}
                </span>
              </summary>

              <div className={styles.advancedGrid}>
                {group.fields.map((field) => {
                  const isNativeColor = isNativeColorValue(field.value);

                  return (
                    <div key={field.path} className={styles.colorField}>
                      <Input
                        key={`${inputsVersion}:${field.path}`}
                        label={field.label}
                        type={isNativeColor ? 'color' : 'text'}
                        defaultValue={
                          isNativeColor ? getNativeColorValue(field.value) : field.value
                        }
                        onChange={(event) =>
                          handleChangeAdvancedColor(
                            field.path,
                            isNativeColor
                              ? getColorInputValue(event.target.value, field.value)
                              : event.target.value,
                          )
                        }
                        color={colors.fieldColor}
                        backgroundColor={colors.fieldBackgroundColor}
                        placeholderColor={settings.mutedColor}
                        xs={12}
                      />
                      <span style={{ color: settings.mutedColor }}>{field.path}</span>
                    </div>
                  );
                })}
              </div>
            </details>
          ))}
        </div>
      </div>

      <div
        className={styles.floatingActions}
        style={{ backgroundColor: colors.backgroundColor, borderColor: settings.themeBorderColor }}
      >
        {showSaveNameInput && canSaveCurrentTheme && (
          <Input
            ref={saveNameInputRef}
            placeholder={t('settings.customization.themeNamePlaceholder')}
            value={themeName}
            onChange={(event) => setThemeName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSaveAsTheme();
              if (event.key === 'Escape') setShowSaveNameInput(false);
            }}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            placeholderColor={settings.mutedColor}
            maxWidth="220px"
          />
        )}

        {canSaveCurrentTheme && (
          <Button
            smallIcon
            text
            title={t('settings.customization.saveAsThemeTitle')}
            icon={() => <SaveIcon size={15} />}
            onClick={handleClickSaveAsTheme}
            color={colors.saveButtonBackgroundColor}
          />
        )}

        {canDiscardCurrentChanges && (
          <Button
            smallIcon
            text
            title={t('settings.customization.discardChangesTitle')}
            icon={() => <CancelIcon size={15} />}
            onClick={handleDiscardCurrentChanges}
            color={colors.cancelButtonBackgroundColor}
          />
        )}

        {canRemoveActiveTheme && (
          <Button
            smallIcon
            text
            title={t('settings.customization.removeThemeTitle')}
            icon={() => <RemoveIcon size={15} />}
            onClick={handleRemoveActiveTheme}
            color={colors.cancelButtonBackgroundColor}
          />
        )}

        <Button
          smallIcon
          text
          title={t('settings.customization.exportThemeTitle')}
          icon={() => <ExportIcon size={15} />}
          onClick={handleExportTheme}
          color={colors.testButtonBackgroundColor}
        />

        <Button
          smallIcon
          text
          title={t('settings.customization.importThemeTitle')}
          icon={() => <ImportIcon size={15} />}
          onClick={() => inputFileRef.current?.click()}
          color={colors.testButtonBackgroundColor}
        />

        <input
          ref={inputFileRef}
          type="file"
          accept="application/json,.json"
          className={styles.hiddenInput}
          onChange={handleImportTheme}
        />
      </div>

      <Modal
        title={t('settings.customization.removeThemeTitle')}
        width="420px"
        show={!!themeToRemove}
        closeOutside
        onClose={() => setThemeToRemove(undefined)}
      >
        <Text small color={colors.color}>
          {t('settings.customization.removeThemeQuestion', { themeName: themeToRemove || '' })}
        </Text>

        <Divider size={14} />

        <Row>
          <Button
            xs={12}
            sm={6}
            onClick={() => setThemeToRemove(undefined)}
            color={colors.testButtonColor}
            backgroundColor={colors.testButtonBackgroundColor}
          >
            {t('settings.customization.cancel')}
          </Button>

          <Button
            xs={12}
            sm={6}
            onClick={confirmRemoveTheme}
            color={colors.cancelButtonColor}
            backgroundColor={colors.cancelButtonBackgroundColor}
          >
            {t('settings.customization.remove')}
          </Button>
        </Row>
      </Modal>
    </div>
  );
});

SettingsCustomizationPanel.displayName = 'SettingsCustomizationPanel';
