import React from 'react';
import { classes } from '@renderer/styles/theme';
import ResizableContainer, { OnResizeCallback } from '@renderer/components/ResizableContainer';
import { Autocomplete } from '@renderer/components/AutocompleteBlank';
import { AutocompleteMultiBlank } from '@renderer/components/AutocompleteMultiBlank';
import { getPrimaryShortcutKeyLabel, isPrimaryShortcutPressed } from '@renderer/utils/keyboard';
import styles from '../../styles.module.css';
import { serializeTableValue } from '../../utils';

type TableCellEditValue = string | number | (string | number)[];

const linkStyle: React.CSSProperties = {
  textDecoration: 'underline dotted',
  cursor: 'pointer',
};

const emptyStyle: React.CSSProperties = {};
const primaryShortcutKeyLabel = getPrimaryShortcutKeyLabel();
const singleLinkTitle = 'Clique para abrir linha referenciada';
const previewLinkTitle = `Clique para visualizar referência; ${primaryShortcutKeyLabel}+click para abrir linha referenciada`;
const openLinkTitle = `${primaryShortcutKeyLabel}+click para abrir linha referenciada`;

interface ITableColumnProps {
  indexRow?: number;
  minWidth?: number;
  columnIndex: number;
  rowHeight: number;
  resizable?: boolean;
  onResize?: OnResizeCallback;
  title?: string;
  onClick?(event: React.MouseEvent<HTMLElement, MouseEvent>): void;
  onContextMenu?: React.MouseEventHandler<HTMLDivElement>;
  onDoubleClick?(rowColumnKey: string): void;
  onBlurCell?(): void;
  onEditCell?(
    rowIndex: number,
    name: string,
    newValue: TableCellEditValue,
    keepEditing?: boolean,
  ): void;
  style?: React.CSSProperties;
  isEditing?: boolean;
  editInitialValue?: string | number;
  isEdited?: boolean;
  value?: number | string | boolean | null | (string | number)[];
  info?: string;
  name?: string;
  rowColumnKey?: string;
  width?: number;
  isLink?: boolean;
  type?: 'text' | 'number' | 'autocomplete' | 'autocomplete-multi';
  dataAutocomplete?: string[];
  onFkCellClick?(name: string, value: any): void;
  onFkCellPreviewClick?(name: string, value: any): void;
  linkClickMode?: 'ctrl' | 'single';
  isSelectedCell?: boolean;
  isSearchMatch?: boolean;
  isActiveSearchMatch?: boolean;
  onSelectCell?(rowIndex: number, colIndex: number): void;
  onStartCellDrag?(
    rowIndex: number,
    colIndex: number,
    event: React.MouseEvent<HTMLElement, MouseEvent>,
  ): void;
  onMoveCellDrag?(rowIndex: number, colIndex: number): void;
}

const TableColumn = ({
  isEditing,
  isEdited,
  title,
  value,
  info,
  indexRow,
  columnIndex,
  rowHeight,
  resizable,
  onResize,
  onClick,
  onContextMenu,
  onDoubleClick,
  minWidth,
  onBlurCell,
  onEditCell,
  rowColumnKey,
  width = minWidth || 200,
  name,
  style: styleExternal = emptyStyle,
  isLink,
  editInitialValue,
  type,
  dataAutocomplete,
  onFkCellClick,
  onFkCellPreviewClick,
  linkClickMode = 'ctrl',
  isSelectedCell,
  isSearchMatch,
  isActiveSearchMatch,
  onSelectCell,
  onStartCellDrag,
  onMoveCellDrag,
}: ITableColumnProps) => {
  const isHeaderColumn = indexRow === undefined;
  const isLinkClickable = isLink && !isHeaderColumn && value !== null && value !== undefined;
  const linkTitle = !isLinkClickable
    ? undefined
    : linkClickMode === 'single'
      ? singleLinkTitle
      : onFkCellPreviewClick
        ? previewLinkTitle
        : openLinkTitle;

  const className = React.useMemo(() => {
    return classes(
      styles.table_column,
      indexRow % 2 ? styles.even : styles.odd,
      resizable && styles.resizable,
      isEdited && styles.edited,
      isHeaderColumn && styles.disableSelection,
      isSearchMatch && !resizable && styles.search_match,
      isActiveSearchMatch && !resizable && styles.search_active_match,
      isSelectedCell && !resizable && styles.cell_selected,
    );
  }, [
    indexRow,
    isActiveSearchMatch,
    isEdited,
    isHeaderColumn,
    isSearchMatch,
    isSelectedCell,
    resizable,
  ]);

  // minify string lenght in cell to improve performance
  const serializedValue = React.useMemo<string | number | undefined>(() => {
    if (value === undefined) return undefined;
    if (typeof value === 'number') return value;

    const serialized = serializeTableValue(value, type);
    const maxValueLenght = Math.ceil(width / 5);
    const valueLenght = maxValueLenght > serialized.length ? serialized.length : maxValueLenght;

    return isEditing ? serialized : serialized.slice(0, valueLenght);
  }, [isEditing, type, value, width]);

  const editedValue = React.useRef<string | number | null>(null);
  const cancelEditRef = React.useRef(false);

  const inputInitialValue: string | number | undefined = editInitialValue ?? serializedValue;
  const comparableInitialValue = [undefined, null].includes(serializedValue) ? '' : serializedValue;

  editedValue.current = [undefined, null].includes(inputInitialValue) ? '' : inputInitialValue;

  const style = React.useMemo(() => {
    return {
      ...styleExternal,
      '--rowIndex': indexRow,
      '--columnIndex': columnIndex,
      '--rowHeight': `${rowHeight}px`,
    } as React.CSSProperties;
  }, [indexRow, columnIndex, rowHeight, styleExternal]);

  const handleSaveInputValue = React.useCallback(() => {
    onBlurCell?.();

    if (cancelEditRef.current) {
      cancelEditRef.current = false;
      return;
    }

    if (String(comparableInitialValue) === String(editedValue.current ?? '')) return;

    onEditCell?.(indexRow, name, editedValue.current);
  }, [comparableInitialValue, indexRow, name, onEditCell, onBlurCell]);

  const handleLinkClick = React.useCallback(
    (event: React.MouseEvent) => {
      if (linkClickMode === 'ctrl' && !isPrimaryShortcutPressed(event)) {
        onFkCellPreviewClick?.(name, value);
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      onFkCellClick?.(name, value);
    },
    [linkClickMode, name, onFkCellClick, onFkCellPreviewClick, value],
  );

  const handleDoubleClick = React.useCallback(() => {
    onDoubleClick?.(rowColumnKey);
  }, [onDoubleClick, rowColumnKey]);

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      if (isHeaderColumn) return onClick?.(event);

      onSelectCell?.(indexRow, columnIndex);
    },
    [columnIndex, indexRow, isHeaderColumn, onClick, onSelectCell],
  );

  const handleMouseDown = React.useCallback(
    (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      if (isHeaderColumn) return;

      onStartCellDrag?.(indexRow, columnIndex, event);
    },
    [columnIndex, indexRow, isHeaderColumn, onStartCellDrag],
  );

  const handleMouseEnter = React.useCallback(() => {
    if (isHeaderColumn) return;

    onMoveCellDrag?.(indexRow, columnIndex);
  }, [columnIndex, indexRow, isHeaderColumn, onMoveCellDrag]);

  const handleInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Enter' && event.key !== 'Escape') return;

      event.preventDefault();

      if (event.key === 'Escape') {
        cancelEditRef.current = true;
        onBlurCell?.();
        return;
      }

      handleSaveInputValue();
    },
    [handleSaveInputValue, onBlurCell],
  );

  const handleInputChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    editedValue.current = event.target.value;
  }, []);

  const handleEditEscapeKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLElement>) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      event.stopPropagation();
      onBlurCell?.();
    },
    [onBlurCell],
  );

  const handleAutocompleteChange = React.useCallback(
    ({ value: newValue }: { value: string | number }) => {
      onBlurCell?.();

      if (newValue === null || value === newValue) return;

      onEditCell?.(indexRow, name, newValue);
    },
    [indexRow, name, onBlurCell, onEditCell, value],
  );

  const handleAutocompleteMultiChange = React.useCallback(
    ({ value: newValue }: { value: (string | number)[] }) => {
      onEditCell?.(indexRow, name, newValue, true);
    },
    [indexRow, name, onEditCell],
  );

  const content = isEditing ? null : isLinkClickable ? (
    <span style={linkStyle} title={linkTitle} onClick={handleLinkClick}>
      {serializedValue}
    </span>
  ) : info && isHeaderColumn ? (
    <span className={styles.header_content}>
      <span className={styles.header_label}>{serializedValue}</span>
      <span className={styles.header_info}>{info}</span>
    </span>
  ) : (
    serializedValue
  );

  if (resizable) {
    return (
      <ResizableContainer
        className={className}
        title={title}
        style={style}
        width={width}
        height={rowHeight}
        minWidth={minWidth}
        onResize={onResize}
        onContextMenu={onContextMenu}
        onDoubleClick={handleDoubleClick}
        onClick={handleClick}
      >
        {content}
      </ResizableContainer>
    );
  }

  if (isEditing) {
    if (type === 'autocomplete') {
      return (
        <Autocomplete
          autoFocus
          backgroundColor={'var(--backgroundColor)'}
          color={'white'}
          data={dataAutocomplete ?? []}
          value={Array.isArray(value) ? null : value}
          name={name}
          containerClassName={classes(className, styles.autocomplete_cell)}
          containerStyle={style}
          className={styles.table_autocomplete_input}
          placeholder={serializedValue === undefined ? '' : String(serializedValue)}
          onBlurWithoutChange={onBlurCell}
          onKeyDown={handleEditEscapeKeyDown}
          onChange={handleAutocompleteChange}
        />
      );
    }

    if (type === 'autocomplete-multi') {
      return (
        <AutocompleteMultiBlank
          autoFocus
          backgroundColor={'var(--backgroundColor)'}
          color={'white'}
          data={dataAutocomplete ?? []}
          value={Array.isArray(value) ? value : []}
          name={name}
          containerClassName={classes(className, styles.autocomplete_cell)}
          containerStyle={style}
          className={styles.table_autocomplete_input}
          placeholder={serializedValue === undefined ? '' : String(serializedValue)}
          onBlurWithoutChange={onBlurCell}
          onKeyDown={handleEditEscapeKeyDown}
          onChange={handleAutocompleteMultiChange}
        />
      );
    }

    return (
      <input
        className={className}
        title={title}
        style={style}
        autoFocus
        spellCheck={false}
        defaultValue={inputInitialValue}
        onBlur={handleSaveInputValue}
        onKeyDown={handleInputKeyDown}
        onChange={handleInputChange}
        onDoubleClick={handleDoubleClick}
        onClick={handleClick}
      />
    );
  }

  return (
    <div
      className={className}
      title={title}
      style={style}
      onDoubleClick={handleDoubleClick}
      onContextMenu={onContextMenu}
      onMouseDown={handleMouseDown}
      onMouseEnter={handleMouseEnter}
      onClick={handleClick}
    >
      {content}
    </div>
  );
};

export default React.memo(TableColumn);
