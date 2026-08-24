import React from 'react';
import * as monaco from './monaco';

import useDebounce from '@renderer/hooks/useDebounce';
import useResize from '@renderer/hooks/useResize';
import styles from './styles.module.css';
import {
  ContextMenu,
  type IContextMenuOption,
  type IContextMenuPosition,
} from '@renderer/components/ContextMenu';
import { useAIChatPanelContext } from '@renderer/contexts/AIChatPanel';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { IDefineSQlAutocompleteParams, defineSQlAutocomplete } from './autocompleteDefault';
import { getCurrentQuerySqlFromContentRange } from '@renderer/utils/sql';
import type { Dialect } from '@renderer/database/dialects';
import { isPrimaryShortcutPressed } from '@renderer/utils/keyboard';

const Editor = ({
  ref,
  initialValue = '',
  selections = [],
  language = 'sql',
  ...props
}: IEditorProps) => {
  const { t } = useI18n();
  const { activeTheme } = useThemeContext();
  const { activeChatId, addEditorSelectionToChatContext } = useAIChatPanelContext();
  const [editor, setEditor] = React.useState<monaco.editor.IStandaloneCodeEditor>();
  const [editorContextMenu, setEditorContextMenu] = React.useState<{
    position: IContextMenuPosition;
    selectedText: string;
  }>();

  const containerRef = React.useRef<HTMLDivElement>(null);
  const addEditorSelectionToChatContextRef = React.useRef(addEditorSelectionToChatContext);
  const onCtrlClickRef = React.useRef(props.onCtrlClick);

  const { width, height } = useResize({ HTMLElement: containerRef.current });

  const stopCtrlClickPropagation = (event: React.MouseEvent<HTMLDivElement>) => {
    if (!props.onCtrlClick || !isPrimaryShortcutPressed(event)) return;

    event.stopPropagation();
  };

  const resize = useDebounce(() => editor?.layout?.(), 10);

  const emitCurrentValueChange = useDebounce(() => {
    props.onChangeCurrentValue?.(getCurrentValue());
  }, 500);

  const emitValueChange = useDebounce(() => {
    props.onChange?.(getValue());
  }, 500);

  const getWordAtPosition = (position: monaco.IPosition) => {
    return editor.getModel().getWordAtPosition(position);
  };

  const setMarkers = (params: IAddMarkerParams[]) => {
    const model = editor.getModel();

    const markers: monaco.editor.IMarkerData[] = [];

    for (const markerParams of params) {
      const { severity, ...otherParams } = markerParams;

      markers.push({
        ...otherParams,
        severity: monaco.MarkerSeverity[severity],
      });
    }

    monaco.editor.setModelMarkers(model, null, markers);
  };

  const focus = () => {
    editor?.focus?.();
  };

  const layout = () => {
    editor?.layout?.();
  };

  const setPosition = (position: monaco.IPosition) => {
    editor?.setPosition?.(position);
    editor?.revealPositionInCenter?.(position);
    focus();
  };

  const getPositionAt = (offset: number) => {
    return editor?.getModel?.()?.getPositionAt?.(offset);
  };

  const getOffsetAt = (position: monaco.IPosition) => {
    return editor?.getModel?.()?.getOffsetAt?.(position);
  };

  const setScroll = (scroll: IScroll) => {
    if (typeof scroll !== 'object') return;
    const { scrollTop = 0, scrollLeft = 0 } = scroll;

    editor?.setScrollTop?.(scrollTop);
    editor?.setScrollLeft?.(scrollLeft);
  };

  const getScroll = (): IScroll => {
    const scrollTop = editor?.getScrollTop?.() || 0;
    const scrollLeft = editor?.getScrollLeft?.() || 0;

    return { scrollTop, scrollLeft };
  };

  const setSelections = (selections: monaco.Selection[]) => {
    if (!selections?.length) return;

    editor?.setSelections?.(selections);
  };

  const getSelections = () => {
    return (editor?.getSelections?.() || []) as monaco.Selection[];
  };

  const getSelection = () => {
    return editor?.getSelection?.();
  };

  const getSelectionValue = (selection: monaco.Selection) => {
    return editor?.getModel?.()?.getValueInRange?.(selection) || '';
  };

  const setValue = (value: string) => {
    return editor?.getModel?.()?.setValue?.(value);
  };

  const getValue = () => {
    return editor?.getModel()?.getValue?.() || '';
  };

  const getCurrentQueryRange = () => {
    const position = editor?.getPosition?.();
    const model = editor?.getModel?.();

    if (!position || !model) return { sql: model?.getValue?.() || '', start: 0, end: 0 };

    const fullContent = model.getValue();
    const cursorOffset = model.getOffsetAt(position);

    return getCurrentQuerySqlFromContentRange(fullContent, cursorOffset);
  };

  const getCurrentValue = () => {
    return getCurrentQueryRange().sql;
  };

  const getSelectedText = React.useCallback(
    (currentEditor: monaco.editor.ICodeEditor | undefined = editor) => {
      const model = currentEditor?.getModel();
      if (!model) return '';

      return (currentEditor?.getSelections() || [])
        .map((selection) => model.getValueInRange(selection).trim())
        .filter(Boolean)
        .join('\n\n');
    },
    [editor],
  );

  const getClipboardSelectedText = React.useCallback(
    (currentEditor: monaco.editor.ICodeEditor) => {
      const model = currentEditor.getModel();
      if (!model) return;

      const selectedValues = (currentEditor.getSelections() || [])
        .filter((selection) => !selection.isEmpty())
        .map((selection) => model.getValueInRange(selection));

      if (!selectedValues.length) return;

      return selectedValues.join(model.getEOL());
    },
    [],
  );

  const isPositionInSelection = React.useCallback(
    (position: monaco.IPosition) => {
      return getSelections().some(
        (selection) =>
          !selection.isEmpty() &&
          selection.containsPosition({
            lineNumber: position.lineNumber,
            column: position.column,
          }),
      );
    },
    [editor],
  );

  const openEditorContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement>) => {
      if (!editor) return;

      event.preventDefault();
      event.stopPropagation();

      const target = editor.getTargetAtClientPoint(event.clientX, event.clientY);
      const position = target?.position;

      if (position && !isPositionInSelection(position)) {
        editor.setPosition(position);
      }

      setEditorContextMenu({
        position: { x: event.clientX, y: event.clientY },
        selectedText: getSelectedText(editor),
      });
    },
    [editor, getSelectedText, isPositionInSelection],
  );

  const pasteTextFallback = React.useCallback(
    async (currentEditor: monaco.editor.ICodeEditor) => {
      if (props.readonly) return;

      const text = await navigator.clipboard.readText();
      if (!text) return;

      const selections = currentEditor.getSelections();
      if (!selections?.length) return;

      currentEditor.pushUndoStop();
      currentEditor.executeEdits(
        'woodbox.contextMenuPaste',
        selections.map((selection) => ({
          range: selection,
          text,
          forceMoveMarkers: true,
        })),
      );
      currentEditor.pushUndoStop();
    },
    [props.readonly],
  );

  const copyTextFallback = React.useCallback(
    async (currentEditor: monaco.editor.ICodeEditor) => {
      const text = getClipboardSelectedText(currentEditor);
      if (text === undefined) return false;

      await navigator.clipboard.writeText(text);
      return true;
    },
    [getClipboardSelectedText],
  );

  const cutTextFallback = React.useCallback(
    async (currentEditor: monaco.editor.ICodeEditor) => {
      if (props.readonly) return false;

      const text = getClipboardSelectedText(currentEditor);
      if (text === undefined) return false;

      await navigator.clipboard.writeText(text);

      const selections = currentEditor.getSelections();
      if (!selections?.length) return true;

      currentEditor.pushUndoStop();
      currentEditor.executeEdits(
        'woodbox.contextMenuCut',
        selections
          .filter((selection) => !selection.isEmpty())
          .map((selection) => ({
            range: selection,
            text: '',
            forceMoveMarkers: true,
          })),
      );
      currentEditor.pushUndoStop();

      return true;
    },
    [getClipboardSelectedText, props.readonly],
  );

  const executeEditorClipboardAction = React.useCallback(
    async (
      actionId:
        | 'editor.action.clipboardCopyAction'
        | 'editor.action.clipboardCutAction'
        | 'editor.action.clipboardPasteAction',
    ) => {
      if (!editor) return;

      editor.focus();

      try {
        if (actionId === 'editor.action.clipboardCutAction' && (await cutTextFallback(editor))) {
          return;
        }

        if (actionId === 'editor.action.clipboardCopyAction' && (await copyTextFallback(editor))) {
          return;
        }

        const action = editor.getAction(actionId);
        if (action) {
          await action.run();
          return;
        }

        if (actionId === 'editor.action.clipboardPasteAction') {
          await pasteTextFallback(editor);
        }
      } catch (error) {
        if (actionId === 'editor.action.clipboardCutAction' && (await cutTextFallback(editor))) {
          return;
        }

        if (actionId === 'editor.action.clipboardCopyAction' && (await copyTextFallback(editor))) {
          return;
        }

        if (actionId === 'editor.action.clipboardPasteAction') {
          await pasteTextFallback(editor);
          return;
        }

        console.error(error);
      } finally {
        setEditorContextMenu(undefined);
      }
    },
    [copyTextFallback, cutTextFallback, editor, pasteTextFallback],
  );

  const initEditor = () => {
    const overflowWidgetsPortal = props.overflowWidgetsPortal
      ? document.createElement('div')
      : undefined;

    if (overflowWidgetsPortal) {
      overflowWidgetsPortal.classList.add('monaco-editor', styles.overflowWidgetsPortal);
      document.body.appendChild(overflowWidgetsPortal);
    }

    const currentEditor = monaco.editor.create(
      containerRef.current,
      {
        language,
        tabSize: 2,
        lineNumbersMinChars: 3,
        value: initialValue,
        theme: 'active-theme',
        readOnly: props.readonly,
        contextmenu: false,
        minimap: { enabled: !props.hidePreview },
        fixedOverflowWidgets: true,
        overflowWidgetsDomNode: overflowWidgetsPortal,
      },
      {
        contextMenuService: {
          showContextMenu: () => undefined,
        },
      },
    );

    currentEditor.addAction({
      id: 'ctrl+enter',
      label: 'ctrl+enter Shortcut',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Enter],
      run: () => {},
    });

    currentEditor.addAction({
      id: 'ctrl+shift+enter',
      label: 'ctrl+shift+enter Shortcut',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyMod.Shift | monaco.KeyCode.Enter],
      run: () => {},
    });

    currentEditor.addAction({
      id: 'ctrl+backslash',
      label: 'ctrl+backslash Shortcut',
      keybindings: [monaco.KeyMod.CtrlCmd | monaco.KeyCode.Backslash],
      run: () => {},
    });

    const getCtrlClickTarget = (position: monaco.IPosition) => {
      const model = currentEditor.getModel();
      const word = model?.getWordAtPosition(position);
      if (!model || !word) return;

      const lineContent = model.getLineContent(position.lineNumber);
      const charBefore = lineContent[word.startColumn - 2];
      let schema: string | undefined;

      if (charBefore === '.') {
        const schemaWord = model.getWordAtPosition({
          lineNumber: position.lineNumber,
          column: word.startColumn - 1,
        });
        schema = schemaWord?.word;
      }

      return {
        word: word.word,
        schema,
        range: new monaco.Range(
          position.lineNumber,
          word.startColumn,
          position.lineNumber,
          word.endColumn,
        ),
      };
    };

    const canOpenCtrlClickTarget = (target: NonNullable<ReturnType<typeof getCtrlClickTarget>>) => {
      const onCtrlClick = onCtrlClickRef.current;
      if (!onCtrlClick) return false;

      return onCtrlClick.canNavigate?.(target.word, target.schema) ?? true;
    };

    let ctrlClickHoverDecorations: string[] = [];

    const clearCtrlClickHover = () => {
      if (!ctrlClickHoverDecorations.length) return;

      ctrlClickHoverDecorations = currentEditor.deltaDecorations(ctrlClickHoverDecorations, []);
    };

    const updateCtrlClickHover = (e: monaco.editor.IEditorMouseEvent) => {
      if (!isPrimaryShortcutPressed(e.event.browserEvent)) {
        clearCtrlClickHover();
        return;
      }

      if (e.target.type !== monaco.editor.MouseTargetType.CONTENT_TEXT || !e.target.position) {
        clearCtrlClickHover();
        return;
      }

      const target = getCtrlClickTarget(e.target.position);
      if (!target || !canOpenCtrlClickTarget(target)) {
        clearCtrlClickHover();
        return;
      }

      ctrlClickHoverDecorations = currentEditor.deltaDecorations(ctrlClickHoverDecorations, [
        {
          range: target.range,
          options: { inlineClassName: styles.ctrlClickLink },
        },
      ]);
    };

    const handleKeyUp = (event: KeyboardEvent) => {
      if (!isPrimaryShortcutPressed(event)) clearCtrlClickHover();
    };

    currentEditor.onMouseMove(updateCtrlClickHover);
    currentEditor.onMouseLeave(clearCtrlClickHover);
    window.addEventListener('keyup', handleKeyUp);
    window.addEventListener('blur', clearCtrlClickHover);
    currentEditor.onDidDispose(() => {
      window.removeEventListener('keyup', handleKeyUp);
      window.removeEventListener('blur', clearCtrlClickHover);
      overflowWidgetsPortal?.remove();
    });

    currentEditor.onMouseUp((e) => {
      if (!isPrimaryShortcutPressed(e.event.browserEvent)) return;
      if (e.target.type !== monaco.editor.MouseTargetType.CONTENT_TEXT) return;
      const position = e.target.position;
      if (!position) return;
      const target = getCtrlClickTarget(position);
      if (!target) return;

      e.event.preventDefault();
      e.event.stopPropagation();
      clearCtrlClickHover();
      currentEditor.focus();

      onCtrlClickRef.current?.(target.word, target.schema);
    });

    return currentEditor;
  };

  const editorContextMenuOptions = React.useMemo<IContextMenuOption[]>(
    () => [
      {
        text: t('common.cut'),
        show: () => !props.readonly,
        onClick: () => executeEditorClipboardAction('editor.action.clipboardCutAction'),
      },
      {
        text: t('common.copy'),
        onClick: () => executeEditorClipboardAction('editor.action.clipboardCopyAction'),
      },
      {
        text: t('common.paste'),
        show: () => !props.readonly,
        onClick: () => executeEditorClipboardAction('editor.action.clipboardPasteAction'),
      },
      {
        text: activeChatId
          ? t('context.addSelectionToAIChat')
          : t('context.addSelectionToNewAIChat'),
        show: () => !!editorContextMenu?.selectedText,
        onClick: () => {
          if (!editorContextMenu?.selectedText) return;

          addEditorSelectionToChatContextRef.current({
            content: editorContextMenu.selectedText,
            language,
          });
          setEditorContextMenu(undefined);
        },
      },
    ],
    [
      activeChatId,
      editorContextMenu?.selectedText,
      executeEditorClipboardAction,
      language,
      props.readonly,
      t,
    ],
  );

  React.useImperativeHandle(
    ref,
    () => ({
      getScroll,
      setScroll,
      getSelection,
      getSelections,
      setSelections,
      getSelectionValue,
      getValue,
      getCurrentValue,
      getCurrentQueryRange,
      setValue,
      setMarkers,
      setPosition,
      focus,
      layout,
      getPositionAt,
      getOffsetAt,
      getWordAtPosition,
      element: editor?.getDomNode?.(),
    }),
    [editor],
  );

  React.useEffect(() => {
    addEditorSelectionToChatContextRef.current = addEditorSelectionToChatContext;
  }, [addEditorSelectionToChatContext]);

  React.useEffect(() => {
    onCtrlClickRef.current = props.onCtrlClick;
  }, [props.onCtrlClick]);

  React.useEffect(() => {
    // Inicializa uma vez por montagem; mudanças de props são sincronizadas nos efeitos abaixo.
    let currentEditor: monaco.editor.IStandaloneCodeEditor;
    let frameId: number | undefined;

    // fix startup freeze
    const timeoutId = setTimeout(() => {
      if (!containerRef.current) return;

      currentEditor = initEditor();
      setEditor(currentEditor);
      if (props.autoFocus) currentEditor.focus();
      frameId = window.requestAnimationFrame(resize);
    });

    return () => {
      clearTimeout(timeoutId);
      if (frameId) window.cancelAnimationFrame(frameId);
      currentEditor?.dispose?.();
    };
  }, []);

  React.useEffect(resize, [width, height]);

  React.useEffect(() => {
    monaco.editor.setTheme('active-theme');
  }, [activeTheme, editor]);

  React.useEffect(() => {
    if (!editor || !props.onUmounted) return;

    return () => {
      const value = getValue();
      const selections = getSelections();
      const scroll = getScroll();

      props.onUmounted?.({ value, selections, scroll });
    };
  }, [editor, props.onUmounted]);

  React.useEffect(() => {
    if (props.value !== undefined && props.value !== getValue()) setValue(props.value);
  }, [editor, props.value]);

  React.useEffect(() => {
    editor?.updateOptions({ readOnly: props.readonly });
  }, [editor, props.readonly]);

  React.useEffect(() => {
    setScroll(props.scroll);
  }, [editor, props.scroll]);

  React.useEffect(() => {
    setSelections(selections);
  }, [editor, selections]);

  React.useEffect(() => {
    const monacoListeners: monaco.IDisposable[] = [];

    if (props.onChangeSelections) {
      const listenerSelections = editor?.onDidChangeCursorSelection?.((e) => {
        const allSelections = [e.selection, ...e.secondarySelections];
        props.onChangeSelections?.(allSelections);
      });

      listenerSelections && monacoListeners.push(listenerSelections);
    }

    if (props.onChange || props.onChangeCurrentValue || props.onDidChangeContent) {
      const listenerValueChange = editor?.getModel?.()?.onDidChangeContent(() => {
        props.onDidChangeContent?.();
        emitValueChange();
        emitCurrentValueChange();
      });

      listenerValueChange && monacoListeners.push(listenerValueChange);
    }

    if (props.onChangeCurrentValue) {
      const listenerCursorPosition = editor?.onDidChangeCursorPosition?.(() => {
        emitCurrentValueChange();
      });

      listenerCursorPosition && monacoListeners.push(listenerCursorPosition);
    }

    return () => {
      monacoListeners.forEach((a) => a?.dispose?.());
    };
  }, [editor, props.onChange, props.onChangeCurrentValue, props.onDidChangeContent]);

  React.useEffect(() => {
    if (!editor) return;

    const model = editor.getModel();
    if (!model) return;

    const disposable = defineSQlAutocomplete(model, props.autocomplete);

    return () => disposable?.dispose();
  }, [editor, props.autocomplete]);


  return (
    <>
      <div
        className={styles.outsideContainer}
        onClickCapture={stopCtrlClickPropagation}
        onContextMenu={openEditorContextMenu}
      >
        <div className={styles.container} ref={containerRef} />
      </div>

      <ContextMenu
        position={editorContextMenu?.position}
        options={editorContextMenuOptions}
        onClose={() => setEditorContextMenu(undefined)}
      />
    </>
  );
};

export default Editor;

export interface IEditorProps {
  ref?: React.Ref<IEditorRef>;
  language?: 'sql' | 'json';
  dialect?: Dialect;
  value?: string;
  initialValue?: string;
  scroll?: IScroll;
  selections?: monaco.Selection[];
  onUmounted?: (data: IDataUmounted) => void;
  onChange?: (value: string) => void;
  onChangeCurrentValue?: (value: string) => void;
  onDidChangeContent?: () => void;
  onChangeSelections?(selections: monaco.Selection[]): void;
  autocomplete?: IDefineSQlAutocompleteParams;
  onCtrlClick?: IEditorCtrlClickHandler;
  readonly?: boolean;
  hidePreview?: boolean;
  autoFocus?: boolean;
  overflowWidgetsPortal?: boolean;
}

export interface IScroll {
  scrollTop: number;
  scrollLeft: number;
}

export interface IDataUmounted {
  value: string;
  scroll: IScroll;
  selections: monaco.Selection[];
}

interface IAddMarkerParams {
  message: string;
  code?: string;
  source?: string;
  startLineNumber: number;
  startColumn: number;
  endLineNumber: number;
  endColumn: number;
  severity: 'Warning' | 'Error' | 'Hint' | 'Info';
}

type IEditorCtrlClickHandler = ((word: string, schema?: string) => void) & {
  canNavigate?: (word: string, schema?: string) => boolean;
};

export interface IEditorRef {
  getCurrentValue(): string;
  getCurrentQueryRange(): { sql: string; start: number; end: number };
  getValue(): string;
  setValue(value: string): void;
  getSelections(): monaco.Selection[];
  setSelections(selections: monaco.Selection[]): void;
  getSelectionValue(selection: monaco.Selection): string;
  getScroll(): IScroll;
  setScroll(scroll: IScroll): void;
  setMarkers(params: IAddMarkerParams[]): void;
  setPosition(position: monaco.IPosition): void;
  focus(): void;
  layout(): void;
  getPositionAt(offset: number): monaco.IPosition | undefined;
  getOffsetAt(position: monaco.IPosition): number | undefined;
  getWordAtPosition(position: monaco.IPosition): monaco.editor.IWordAtPosition;
  element?: HTMLElement;
}
