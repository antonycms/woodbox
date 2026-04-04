import React from 'react';
import * as monaco from 'monaco-editor';

import useDebounce from '@renderer/hooks/useDebounce';
import useResize from '@renderer/hooks/useResize';
import styles from './styles.module.css';
import { useThemeContext } from '@renderer/contexts/Theme';
import { IDefineSQlAutocompleteParams, defineSQlAutocomplete } from './autocompleteDefault';
import { getCurrentQuerySqlFromContent } from '@renderer/utils/sql';

const Editor = React.forwardRef<IEditorRef, IEditorProps>(
  ({ initialValue = '', selections = [], language = 'sql', ...props }, ref) => {
    const { activeTheme } = useThemeContext();
    const containerRef = React.useRef<HTMLDivElement>();
    const { width, height } = useResize({ HTMLElement: containerRef.current });
    const [editor, setEditor] = React.useState<monaco.editor.IStandaloneCodeEditor>();

    const resize = useDebounce(() => editor?.layout?.(), 10);

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

    const getCurrentValue = () => {
      return getCurrentQuerySqlFromContent(editor?.getModel()?.getValue?.() || '');
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
        setValue,
        setMarkers,
        getWordAtPosition,
        element: editor?.getDomNode?.(),
      }),
      [editor],
    );

    React.useEffect(() => {
      let currentEditor: monaco.editor.IStandaloneCodeEditor;

      // fix startup freeze
      setTimeout(() => {
        currentEditor = initEditor();
        setEditor(currentEditor);
      });

      return () => {
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
      if (props.value !== undefined) setValue(props.value);
    }, [editor, props.value]);

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

      if (props.onChange || props.onChangeCurrentValue) {
        const listenerValueChange = editor?.getModel?.()?.onDidChangeContent(() => {
          const value = getValue();
          const currentValue = getCurrentQuerySqlFromContent(value);

          props.onChange?.(value);
          props.onChangeCurrentValue?.(currentValue);
        });

        listenerValueChange && monacoListeners.push(listenerValueChange);
      }

      return () => {
        monacoListeners.forEach((a) => a?.dispose?.());
      };
    }, [editor, props.onChange, props.onChangeCurrentValue]);

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
  },
);

Editor.displayName = 'Editor';

export default Editor;

export interface IEditorProps {
  language?: 'sql' | 'json';
  dialect: 'postgres';
  value?: string;
  initialValue?: string;
  scroll?: IScroll;
  selections?: monaco.Selection[];
  onUmounted?: (data: IDataUmounted) => void;
  onChange?: (value: string) => void;
  onChangeCurrentValue?: (value: string) => void;
  onChangeSelections?(selections: monaco.Selection[]): void;
  autocomplete?: IDefineSQlAutocompleteParams;
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
  getValue(): string;
  setValue(value: string): void;
  getSelections(): monaco.Selection[];
  setSelections(selections: monaco.Selection[]): void;
  getSelectionValue(selection: monaco.Selection): string;
  getScroll(): IScroll;
  setScroll(scroll: IScroll): void;
  setMarkers(params: IAddMarkerParams[]): void;
  getWordAtPosition(position: monaco.IPosition): monaco.editor.IWordAtPosition;
  element?: HTMLElement;
}
