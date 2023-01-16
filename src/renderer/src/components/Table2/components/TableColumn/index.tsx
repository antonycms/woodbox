import React from 'react';
import clsx from 'clsx';
import styles from '../../styles.module.css';
import ResizableContainer, {
  IResizableDivProps,
  OnResizeCallback,
} from '@renderer/components/ResizableContainer';

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
  type: 'string' | 'number' | 'boolean';
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
}: ITableColumnProps) => {
  const editedValue = React.useRef(value);
  const isHeaderColumn = indexRow === undefined;

  const className = (() => {
    return clsx(
      styles.table_column,
      indexRow % 2 ? styles.even : styles.odd,
      resizable && styles.resizable,
      isEdited && styles.edited,
      isHeaderColumn && styles.disableSelection,
    );
  })();

  // minify string lenght in cell to improve performance
  const serializedValue = (() => {
    if (isEditing) return null;
    if (typeof value === 'boolean' || typeof value === null) return `${value}`.toUpperCase();
    if (typeof value !== 'string') return value;

    const maxValueLenght = Math.ceil(width / 5);
    const valueLenght = maxValueLenght > value.length ? value.length : maxValueLenght;

    return value.slice(0, valueLenght);
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
            defaultValue={value}
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
    >
      {serializedValue}
    </ColumnComponent>
  );
};

export default React.memo(TableColumn);
