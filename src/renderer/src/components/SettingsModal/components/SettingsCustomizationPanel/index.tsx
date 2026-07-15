import React from 'react';
import { Autocomplete } from '@renderer/components/Autocomplete';
import { Button } from '@renderer/components/Button';
import { Divider } from '@renderer/components/Divider';
import { Input } from '@renderer/components/Input';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Text } from '@renderer/components/Text';
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

const themeGroupLabels = {
  welcome: 'Boas-vindas',
  sideBar: 'Sidebar',
  mainTab: 'Abas principais',
  toast: 'Toasts',
  contextMenu: 'Menu contextual',
  editor: 'Editor SQL',
  table: 'Tabela',
  modal: 'Modal',
  tableInfo: 'Informações da tabela',
  queryEditor: 'Editor de query',
};

const themeAttributeLabels = {
  color: 'Texto',
  backgroundColor: 'Fundo',
  fieldColor: 'Texto do campo',
  fieldPlaceholderColor: 'Placeholder do campo',
  fieldBackgroundColor: 'Fundo do campo',
  fieldLabelColor: 'Label do campo',
  borderColor: 'Borda',
  ascentColor: 'Destaque',
  saveButtonColor: 'Texto do botão salvar',
  saveButtonBackgroundColor: 'Fundo do botão salvar',
  cancelButtonColor: 'Texto do botão cancelar',
  cancelButtonBackgroundColor: 'Fundo do botão cancelar',
  testButtonColor: 'Texto do botão auxiliar',
  testButtonBackgroundColor: 'Fundo do botão auxiliar',
  lineNumberColor: 'Número da linha',
  currentLineNumberColor: 'Número da linha ativa',
  cursorColor: 'Cursor',
  currentLineBackgroundColor: 'Linha ativa',
  selectionColor: 'Seleção',
  keywordColor: 'Palavra-chave',
  identifierColor: 'Identificador',
  numberColor: 'Número',
  delimiterColor: 'Delimitador',
  stringColor: 'Texto SQL',
  colorHeader: 'Texto do cabeçalho',
  backgroundColorHeader: 'Fundo do cabeçalho',
  backgroundColorRowOdd: 'Fundo da linha ímpar',
  colorRowOdd: 'Texto da linha ímpar',
  backgroundColorRowEven: 'Fundo da linha par',
  colorRowEven: 'Texto da linha par',
  backgroundColorColumnEdited: 'Fundo da coluna editada',
  colorColumnEdited: 'Texto da coluna editada',
  selectedColor: 'Texto selecionado',
  selectedBackgroundColor: 'Fundo selecionado',
  selectedBorderColor: 'Borda selecionada',
};

const themeLabels = {
  'default-theme': 'Aura (padrão)',
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

const getThemeLabel = (theme: ITheme) => themeLabels[theme.name] || theme.name;

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

const cloneWithPathValue = (theme: ITheme<string>, path: string, value: string): ITheme => {
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

const getAdvancedThemeFields = (theme: ITheme<string>) => {
  const groups = new Map<string, IAdvancedThemeField[]>();

  const walk = (target: unknown, path: string[] = []) => {
    if (!target || typeof target !== 'object') return;

    const themePart = target as Record<string, unknown>;

    for (const key in themePart) {
      if (key === 'name' || key === '__colors') continue;

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
      const parentPath = nextPath.slice(1, -1).map(formatPathPart).join(' / ');
      const label = themeAttributeLabels[fieldName] || formatPathPart(fieldName);

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
    label: themeGroupLabels[name] || formatPathPart(name),
    fields,
  }));
};

export const SettingsCustomizationPanel = React.memo(() => {
  const { activeTheme, availableThemes, addTheme, removeTheme, changeTheme } = useThemeContext();
  const { showToast } = useToast();
  const inputFileRef = React.useRef<HTMLInputElement>(null);
  const saveNameInputRef = React.useRef<HTMLInputElement>(null);
  const baseThemeNameRef = React.useRef(
    activeTheme.name === currentCustomThemeName ? defaultThemeName : activeTheme.name,
  );

  const [themeName, setThemeName] = React.useState('');
  const [inputsVersion, setInputsVersion] = React.useState(0);
  const [showSaveNameInput, setShowSaveNameInput] = React.useState(false);
  const [themeToRemove, setThemeToRemove] = React.useState<string>();

  const { modal: colors, __colors } = activeTheme;

  const advancedGroups = React.useMemo(() => {
    return getAdvancedThemeFields(activeTheme);
  }, [activeTheme]);
  const panelStyle = React.useMemo(
    () =>
      ({
        '--settings-option-hover-background-color': __colors.darkLightDeep,
        '--settings-floating-shadow-color': __colors.shadow,
      } as React.CSSProperties),
    [__colors.darkLightDeep, __colors.shadow],
  );

  const isCurrentCustomTheme = activeTheme.name === currentCustomThemeName;
  const isBuiltinTheme = builtinThemeNames.includes(activeTheme.name);
  const canRemoveThemeName = React.useCallback((themeName: string) => {
    return !builtinThemeNames.includes(themeName) && themeName !== currentCustomThemeName;
  }, []);
  const canSaveCurrentTheme = isCurrentCustomTheme;
  const canDiscardCurrentChanges = isCurrentCustomTheme;
  const canRemoveActiveTheme = canRemoveThemeName(activeTheme.name);
  const canExportActiveTheme = !isBuiltinTheme;

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
        title: 'Informe um nome',
        description: 'Digite um nome para salvar o tema atual.',
      });
      return;
    }

    if (builtinThemeNames.includes(nextThemeName)) {
      showToast({
        type: 'warn',
        title: 'Nome reservado',
        description: 'Escolha outro nome para o tema.',
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
      title: 'Tema salvo',
      description: `${nextThemeName} foi adicionado à seleção.`,
    });
  }, [activeTheme, addTheme, showToast, themeName]);

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
      title: 'Alterações descartadas',
      description: 'O tema temporário foi removido.',
    });
  }, [removeTheme, showToast]);

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
      title: 'Tema removido',
      description: `${themeToRemove} foi removido da seleção.`,
    });
  }, [activeTheme.name, removeTheme, showToast, themeToRemove]);

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
          throw new Error('Arquivo de tema inválido.');
        }

        addTheme(importedTheme, { activate: true });
        baseThemeNameRef.current = importedTheme.name;
        setShowSaveNameInput(false);
        setInputsVersion((value) => value + 1);
        showToast({
          type: 'success',
          title: 'Tema importado',
          description: `${importedTheme.name} foi adicionado à seleção.`,
        });
      } catch (error) {
        showToast({
          type: 'error',
          title: 'Falha ao importar tema',
          description: error.message,
        });
      }
    },
    [addTheme, showToast],
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
          Personalização
        </Text>

        <Divider size={8} />

        <Row>
          <Autocomplete
            required
            clearable={false}
            data={availableThemes}
            label="Tema ativo"
            value={activeTheme.name}
            extractLabel={getThemeLabel}
            extractValue={(theme) => theme.name}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            xs={12}
            onChange={(event) => handleChangeTheme(String(event.value))}
            renderOptionActions={(theme) =>
              canRemoveThemeName(theme.name) && (
                <button
                  type="button"
                  title="Remover tema"
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

        <Text small color={__colors.gray}>
          Ao alterar uma cor, será criado um tema “{currentCustomThemeName}”. Você pode definir um
          nome ao salvar.
        </Text>

        <Divider size={10} />

        <div
          className={styles.advancedGroups}
          style={
            {
              '--theme-border-color': __colors.lightGray,
              '--theme-panel-background-color': __colors.darkLightBar,
              '--theme-hover-background-color': __colors.darkLightDeep,
              '--theme-muted-color': __colors.gray,
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
                        placeholderColor={__colors.gray}
                        xs={12}
                      />
                      <span style={{ color: __colors.gray }}>{field.path}</span>
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
        style={{ backgroundColor: colors.backgroundColor, borderColor: __colors.lightGray }}
      >
        {showSaveNameInput && canSaveCurrentTheme && (
          <Input
            ref={saveNameInputRef}
            placeholder="Nome do tema"
            value={themeName}
            onChange={(event) => setThemeName(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleSaveAsTheme();
              if (event.key === 'Escape') setShowSaveNameInput(false);
            }}
            color={colors.fieldColor}
            backgroundColor={colors.fieldBackgroundColor}
            placeholderColor={__colors.gray}
            maxWidth="220px"
          />
        )}

        {canSaveCurrentTheme && (
          <Button
            smallIcon
            text
            title="Salvar como tema"
            icon={() => <SaveIcon size={15} />}
            onClick={handleClickSaveAsTheme}
            color={colors.saveButtonBackgroundColor}
          />
        )}

        {canDiscardCurrentChanges && (
          <Button
            smallIcon
            text
            title="Descartar alterações"
            icon={() => <CancelIcon size={15} />}
            onClick={handleDiscardCurrentChanges}
            color={colors.cancelButtonBackgroundColor}
          />
        )}

        {canRemoveActiveTheme && (
          <Button
            smallIcon
            text
            title="Remover tema"
            icon={() => <RemoveIcon size={15} />}
            onClick={handleRemoveActiveTheme}
            color={colors.cancelButtonBackgroundColor}
          />
        )}

        {canExportActiveTheme && (
          <Button
            smallIcon
            text
            title="Exportar tema"
            icon={() => <ExportIcon size={15} />}
            onClick={handleExportTheme}
            color={colors.testButtonBackgroundColor}
          />
        )}

        <Button
          smallIcon
          text
          title="Importar tema"
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
        title="Remover tema"
        width="420px"
        show={!!themeToRemove}
        closeOutside
        onClose={() => setThemeToRemove(undefined)}
      >
        <Text small color={colors.color}>
          Remover o tema “{themeToRemove}”?
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
            Cancelar
          </Button>

          <Button
            xs={12}
            sm={6}
            onClick={confirmRemoveTheme}
            color={colors.cancelButtonColor}
            backgroundColor={colors.cancelButtonBackgroundColor}
          >
            Remover
          </Button>
        </Row>
      </Modal>
    </div>
  );
});

SettingsCustomizationPanel.displayName = 'SettingsCustomizationPanel';
