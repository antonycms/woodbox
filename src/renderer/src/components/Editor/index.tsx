import React from 'react';
import { editor as monacoEditor, KeyMod, KeyCode, Selection, IDisposable } from 'monaco-editor';

import useDebounce from '@renderer/hooks/useDebounce';
import useResize from '@renderer/hooks/useResize';
import styles from './styles.module.css';

const Editor = React.forwardRef<IEditorRef, IEditorProps>(
  ({ initialValue = '', selections = [], ...props }, ref) => {
    const containerRef = React.useRef<HTMLDivElement>();
    const { width, height } = useResize({ HTMLElement: containerRef.current });
    const [editor, setEditor] = React.useState<monacoEditor.IStandaloneCodeEditor>();

    const resize = useDebounce(() => editor?.layout?.(), 10);

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

    const setSelections = (selections: Selection[]) => {
      if (!selections?.length) return;

      editor?.setSelections?.(selections);
    };

    const getSelections = () => {
      return (editor?.getSelections?.() || []) as Selection[];
    };

    const getSelection = () => {
      return editor?.getSelection?.();
    };

    const getSelectionValue = (selection: Selection) => {
      return editor?.getModel?.()?.getValueInRange?.(selection) || '';
    };

    const setValue = (value: string) => {
      return editor?.getModel?.()?.setValue?.(value);
    };

    const getValue = () => {
      return editor?.getModel()?.getValue?.() || '';
    };

    const initEditor = () => {
      const currentEditor = monacoEditor.create(
        containerRef.current,
        {
          value: initialValue,
          language: 'sql',
          theme: 'default-theme',
          lineNumbersMinChars: 3,
          tabSize: 2,
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
        keybindings: [KeyMod.CtrlCmd | KeyCode.Enter],
        run: () => {},
      });

      currentEditor.focus();
      return currentEditor;
    };

    React.useImperativeHandle(
      ref,
      () => ({
        getScroll,
        setScroll,
        getSelection,
        getSelections,
        getSelectionValue,
        setSelections,
        getValue,
        setValue,
        element: editor?.getDomNode?.(),
      }),
      [editor],
    );

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
      const currentEditor = initEditor();
      setEditor(currentEditor);

      return () => {
        currentEditor?.dispose?.();
      };
    }, []);

    React.useEffect(resize, [width, height]);

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
      const monacoListeners: IDisposable[] = [];

      if (props.onChangeSelections) {
        const listenerSelections = editor?.onDidChangeCursorSelection?.((e) => {
          const allSelections = [e.selection, ...e.secondarySelections];
          props.onChangeSelections?.(allSelections);
        });

        listenerSelections && monacoListeners.push(listenerSelections);
      }

      if (props.onChange) {
        const listenerValueChange = editor?.getModel?.()?.onDidChangeContent(() => {
          props.onChange?.(getValue());
        });

        listenerValueChange && monacoListeners.push(listenerValueChange);
      }

      return () => {
        monacoListeners.forEach((a) => a?.dispose?.());
      };
    }, [editor, props.onChange]);

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
  dialect: 'postgres';
  value?: string;
  initialValue?: string;
  scroll?: IScroll;
  selections?: Selection[];
  onUmounted?: (data: IDataUmounted) => void;
  onChange?: (value: string) => void;
  onChangeSelections?(selections: Selection[]): void;
}

export interface IScroll {
  scrollTop: number;
  scrollLeft: number;
}

export interface IDataUmounted {
  value: string;
  scroll: IScroll;
  selections: Selection[];
}

export interface IEditorRef {
  getValue(): string;
  setValue(value: string): void;
  getSelections(): Selection[];
  setSelections(selections: Selection[]): void;
  getSelectionValue(selection: Selection): string;
  getScroll(): IScroll;
  setScroll(scroll: IScroll): void;
  element?: HTMLElement;
}
