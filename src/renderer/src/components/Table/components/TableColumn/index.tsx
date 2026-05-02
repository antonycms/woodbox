import React from 'react';
import { classes } from '@renderer/styles/theme';
import ResizableContainer, { OnResizeCallback } from '@renderer/components/ResizableContainer';
import styles from '../../styles.module.css';

interface ITableColumnProps {
  indexRow?: number;
  minWidth?: number;
  columnIndex: number;
  rowHeight: number;
  resizable?: boolean;
  onResize?: OnResizeCallback;
  title?: string;
  onClick?(): void;
  onDoubleClick?(rowColumnKey: string): void;
  onBlurCell?(): void;
  onEditCell?(rowIndex: number, name: string, newValue: string | number): void;
  style?: React.CSSProperties;
  isEditing?: boolean;
  isEdited?: boolean;
  value?: number | string;
  name?: string;
  rowColumnKey?: string;
  width?: number;
  isLink?: boolean;
  onFkCellClick?(name: string, value: any): void;
  isSelectedCell?: boolean;
  onSelectCell?(rowIndex: number, colIndex: number): void;
  // type: 'string' | 'number' | 'boolean';
}

const getInheritedSelectionStyle = (
  backgroundColor?: React.CSSProperties['backgroundColor'],
): React.CSSProperties => {
  if (typeof backgroundColor !== 'string') return {};

  const color = backgroundColor.trim();

  const hex = color.match(/^#([0-9a-fA-F]{3,4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/);
  if (hex) {
    const value = hex[1];
    const rgb =
      value.length <= 4
        ? value
            .slice(0, 3)
            .split('')
            .map((char) => char + char)
            .join('')
        : value.slice(0, 6);

    return {
      '--rowSelectedBackgroundColor': `#${rgb}66`,
      '--rowSelectedBorderColor': `#${rgb}`,
    } as React.CSSProperties;
  }

  const rgba = color.match(
    /^rgba?\(\s*(\d{1,3})\s*,\s*(\d{1,3})\s*,\s*(\d{1,3})(?:\s*,\s*[\d.]+)?\s*\)$/i,
  );
  if (rgba) {
    const [, r, g, b] = rgba;

    return {
      '--rowSelectedBackgroundColor': `rgba(${r}, ${g}, ${b}, 0.4)`,
      '--rowSelectedBorderColor': `rgb(${r}, ${g}, ${b})`,
    } as React.CSSProperties;
  }

  return {};
};

const TableColumn = ({
  isEditing,
  isEdited,
  title,
  value,
  indexRow,
  columnIndex,
  rowHeight,
  resizable,
  onResize,
  onClick,
  onDoubleClick,
  minWidth,
  onBlurCell,
  onEditCell,
  rowColumnKey,
  width = minWidth || 200,
  name,
  style: styleExternal = {},
  isLink,
  onFkCellClick,
  isSelectedCell,
  onSelectCell,
}: ITableColumnProps) => {
  const editedValue = React.useRef(value);
  const isHeaderColumn = indexRow === undefined;
  const isLinkClickable = isLink && !isHeaderColumn && value !== null && value !== undefined;

  const className = (() => {
    return classes(
      styles.table_column,
      indexRow % 2 ? styles.even : styles.odd,
      resizable && styles.resizable,
      isEdited && styles.edited,
      isHeaderColumn && styles.disableSelection,
      isSelectedCell && !resizable && styles.cell_selected,
    );
  })();

  // minify string lenght in cell to improve performance
  const serializedValue = (() => {
    let v: any = value;

    if (typeof v === 'boolean' || typeof v === null) v = `${v}`;
    else if (v instanceof Date) v = v.toISOString();
    else if (typeof v === 'object') v = JSON.stringify(v);
    else if (typeof v !== 'string') return v;

    const maxValueLenght = Math.ceil(width / 5);
    const valueLenght = maxValueLenght > v.length ? v.length : maxValueLenght;

    return isEditing ? v : v.slice(0, valueLenght);
  })();

  const style = React.useMemo(() => {
    return {
      ...styleExternal,
      ...getInheritedSelectionStyle(styleExternal.backgroundColor),
      '--rowIndex': indexRow,
      '--columnIndex': columnIndex,
      '--rowHeight': `${rowHeight}px`,
    } as React.CSSProperties;
  }, [indexRow, columnIndex, rowHeight, styleExternal]);

  const handleSaveInputValue = React.useCallback(() => {
    onBlurCell?.();

    if (value === editedValue.current) return;

    onEditCell?.(indexRow, name, editedValue.current);
  }, [value, indexRow, name, onEditCell, onBlurCell]);

  const content = isEditing ? null : isLinkClickable ? (
    <span
      style={{ textDecoration: 'underline dotted', cursor: 'pointer' }}
      title="Ctrl+click para abrir linha referenciada"
      onClick={(e: React.MouseEvent) => {
        if (e.ctrlKey) {
          e.preventDefault();
          e.stopPropagation();
          onFkCellClick?.(name, value);
        }
      }}
    >
      {serializedValue}
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
        onDoubleClick={() => onDoubleClick?.(rowColumnKey)}
        onClick={() => {
          if (isHeaderColumn) return onClick?.();
          onSelectCell?.(indexRow, columnIndex);
        }}
      >
        {content}
      </ResizableContainer>
    );
  }

  if (isEditing) {
    return (
      <input
        className={className}
        title={title}
        style={style}
        autoFocus
        spellCheck={false}
        defaultValue={serializedValue}
        onBlur={handleSaveInputValue}
        onChange={(e) => {
          editedValue.current = e.target.value;
        }}
        onDoubleClick={() => onDoubleClick?.(rowColumnKey)}
        onClick={() => onSelectCell?.(indexRow, columnIndex)}
      />
    );
  }

  return (
    <div
      className={className}
      title={title}
      style={style}
      onDoubleClick={() => onDoubleClick?.(rowColumnKey)}
      onClick={() => {
        if (isHeaderColumn) return onClick?.();
        onSelectCell?.(indexRow, columnIndex);
      }}
    >
      {content}
    </div>
  );
};

export default React.memo(TableColumn);
