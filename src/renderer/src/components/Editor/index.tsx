import React from 'react';
import * as monaco from 'monaco-editor';

import useDebounce from '@renderer/hooks/useDebounce';
import useResize from '@renderer/hooks/useResize';
import styles from './styles.module.css';
import { useThemeContext } from '@renderer/contexts/Theme';
import { IDefineSQlAutocompleteParams, defineSQlAutocomplete } from './autocompleteDefault';
import { getCurrentQuerySqlFromContentRange } from '@renderer/utils/sql';
import type { Dialect } from '@renderer/database/dialects';

const Editor = ({
  ref,
  initialValue = '',
  selections = [],
  language = 'sql',
  ...props
}: IEditorProps) => {
  const { activeTheme } = useThemeContext();
  const containerRef = React.useRef<HTMLDivElement>(null);
  const { width, height } = useResize({ HTMLElement: containerRef.current });
  const [editor, setEditor] = React.useState<monaco.editor.IStandaloneCodeEditor>();
  const onCtrlClickRef = React.useRef(props.onCtrlClick);
  React.useEffect(() => {
    onCtrlClickRef.current = props.onCtrlClick;
  }, [props.onCtrlClick]);

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

  const setPosition = (position: monaco.IPosition) => {
    editor?.setPosition?.(position);
    editor?.revealPositionInCenter?.(position);
    editor?.focus?.();
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

  const initEditor = () => {
    const currentEditor = monaco.editor.create(
      containerRef.current,
      {
        language,
        tabSize: 2,
        lineNumbersMinChars: 3,
        value: initialValue,
        theme: 'active-theme',
        readOnly: props.readonly,
        minimap: { enabled: !props.hidePreview },
      },
      {
        contextMenuService: {
          showContextMenu: (b) => console.log(b),
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

    currentEditor.onMouseDown((e) => {
      if (!e.event.ctrlKey) return;
      if (e.target.type !== monaco.editor.MouseTargetType.CONTENT_TEXT) return;
      const position = e.target.position;
      if (!position) return;
      const model = currentEditor.getModel();
      const word = model?.getWordAtPosition(position);
      if (!word) return;

      const lineContent = model?.getLineContent(position.lineNumber) || '';
      const charBefore = lineContent[word.startColumn - 2];
      let schema: string | undefined;
      if (charBefore === '.') {
        const schemaWord = model?.getWordAtPosition({
          lineNumber: position.lineNumber,
          column: word.startColumn - 1,
        });
        schema = schemaWord?.word;
      }

      onCtrlClickRef.current?.(word.word, schema);
    });

    return currentEditor;
  };

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
      getPositionAt,
      getOffsetAt,
      getWordAtPosition,
      element: editor?.getDomNode?.(),
    }),
    [editor],
  );

  React.useEffect(() => {
    let currentEditor: monaco.editor.IStandaloneCodeEditor;

    // fix startup freeze
    const timeoutId = setTimeout(() => {
      if (!containerRef.current) return;

      currentEditor = initEditor();
      setEditor(currentEditor);
    });

    return () => {
      clearTimeout(timeoutId);
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

    const disposable = defineSQlAutocomplete(props.autocomplete);

    return () => disposable?.dispose();
  }, [editor, props.autocomplete]);

  return (
    <div className={styles.outsideContainer}>
      <div className={styles.container} ref={containerRef} />
    </div>
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
  onCtrlClick?: (word: string, schema?: string) => void;
  readonly?: boolean;
  hidePreview?: boolean;
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
  getPositionAt(offset: number): monaco.IPosition | undefined;
  getOffsetAt(position: monaco.IPosition): number | undefined;
  getWordAtPosition(position: monaco.IPosition): monaco.editor.IWordAtPosition;
  element?: HTMLElement;
}
