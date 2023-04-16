import React from 'react';
import * as monaco from 'monaco-editor';

import useDebounce from '@renderer/hooks/useDebounce';
import useResize from '@renderer/hooks/useResize';
import styles from './styles.module.css';
import { useThemeContext } from '@renderer/contexts/Theme';
import { defineSQlAutocomplete } from './autocompleteDefault';

const Editor = React.forwardRef<IEditorRef, IEditorProps>(
  ({ initialValue = '', selections = [], language = 'sql', ...props }, ref) => {
    const { activeTheme } = useThemeContext();
    const containerRef = React.useRef<HTMLDivElement>();
    const { width, height } = useResize({ HTMLElement: containerRef.current });
    const [editor, setEditor] = React.useState<monaco.editor.IStandaloneCodeEditor>();

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

    const initEditor = () => {
      const currentEditor = monaco.editor.create(
        containerRef.current,
        {
          language,
          tabSize: 2,
          lineNumbersMinChars: 3,
          value: initialValue,
          theme: 'active-theme',
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
        getSelectionValue,
        setSelections,
        getValue,
        setValue,
        element: editor?.getDomNode?.(),
      }),
      [editor],
    );

    React.useEffect(() => {
      const currentEditor = initEditor();
      setEditor(currentEditor);

      return () => {
        currentEditor?.dispose?.();
      };
    }, []);

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
      const monacoListeners: monaco.IDisposable[] = [];

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

    React.useEffect(() => {
      if (!editor) return;

      const schemas = [
        { name: 'sistema' },
        { name: 'recursos_humanos' },
      ];
      const tables = [
        { name: 'usuario', schema: 'sistema' },
        { name: 'pessoa', schema: 'recursos_humanos' },
      ];

      const aliases = [
        { name: 'u' },
        { name: 'p' },
      ]

      const columns = [
        { name: 'seq_usuario', alias: 'u' },
        { name: 'cod_pessoa', alias: 'u' },
        { name: 'ind_status', alias: 'u' },
        { name: 'seq_pessoa', alias: 'p' },
        { name: 'nom_pessoa', alias: 'p' },
        { name: 'nom_email', alias: 'p' },
      ]

      const disposable = defineSQlAutocomplete({ schemas, tables, aliases, columns });

      return () => disposable?.dispose();
    }, [editor, /* tables */]);

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
  onChangeSelections?(selections: monaco.Selection[]): void;
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

export interface IEditorRef {
  getValue(): string;
  setValue(value: string): void;
  getSelections(): monaco.Selection[];
  setSelections(selections: monaco.Selection[]): void;
  getSelectionValue(selection: monaco.Selection): string;
  getScroll(): IScroll;
  setScroll(scroll: IScroll): void;
  element?: HTMLElement;
}
