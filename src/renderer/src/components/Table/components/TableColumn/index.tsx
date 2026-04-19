import React from 'react';
import { classes } from '@renderer/styles/theme';
import ResizableContainer, {
  IResizableDivProps,
  OnResizeCallback,
} from '@renderer/components/ResizableContainer';
import styles from '../../styles.module.css';

interface ITableColumnProps {
  indexRow?: number;
  minWidth?: number;
  columnIndex: number;
  rowHeight: number;
  resizable?: boolean;
  onResize?: OnResizeCallback;
  onDoubleClick?(rowColumnKey: string): void;
  onBlurCell?(): void;
  onEditCell?(rowIndex: number, name: string, newValue: string | number): void;
  style?: React.CSSProperties;
  isEditing?: boolean;
  isEdited?: boolean;
  value?: number | string;
  name?: string;
  rowColumnKey?: string;
  width: number;
  isLink?: boolean;
  onFkCellClick?(name: string, value: any): void;
  isSelectedCell?: boolean;
  onSelectCell?(rowIndex: number, colIndex: number): void;
  // type: 'string' | 'number' | 'boolean';
}

const TableColumn = ({
  isEditing,
  isEdited,
  value,
  indexRow,
  columnIndex,
  rowHeight,
  resizable,
  onResize,
  onDoubleClick,
  minWidth,
  onBlurCell,
  onEditCell,
  rowColumnKey,
  width,
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

  const ColumnComponent = React.useMemo(() => {
    const Cp = (propsLocal: IResizableDivProps | React.InputHTMLAttributes<any>) => {
      if (resizable) {
        const props = propsLocal as IResizableDivProps;

        return (
          <ResizableContainer
            {...props}
            width={props.width as number}
            height={props.height as number}
            minWidth={minWidth}
            onResize={onResize}
          />
        );
      }

      const props = propsLocal as React.InputHTMLAttributes<any>;

      if (isEditing) {
        return (
          <input
            {...props}
            autoFocus
            spellCheck={false}
            defaultValue={serializedValue}
            onBlur={handleSaveInputValue}
            onChange={(e) => {
              editedValue.current = e.target.value;
            }}
          />
        );
      }

      return <div {...props} />;
    };

    return Cp;
  }, [resizable, minWidth, isEditing, handleSaveInputValue]);

  return (
    <ColumnComponent
      className={className}
      style={style}
      onDoubleClick={() => onDoubleClick?.(rowColumnKey)}
      onClick={() => onSelectCell?.(indexRow, columnIndex)}
    >
      {isEditing ? null : isLinkClickable ? (
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
      )}
    </ColumnComponent>
  );
};

export default React.memo(TableColumn);
