import React from 'react';
import clsx from 'clsx';
import styles from '../../styles.module.css';
import ResizableContainer, { OnResizeCallback } from '@renderer/components/ResizableContainer';

interface ITableColumnProps {
  indexRow?: number;
  minWidth?: number;
  columnIndex: number;
  rowHeight: number;
  resizable?: boolean;
  onResize?: OnResizeCallback;
  onDoubleClick?: React.MouseEventHandler<HTMLDivElement>;
  onSave?(newValue: string | number): void;
  style?: React.CSSProperties;
  isEditing?: boolean;
  isEdited?: boolean;
  value: number | string;
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
  onSave,
  style: styleExternal = {},
}: ITableColumnProps) => {
  const editedValue = React.useRef(value);
  const isHeaderColumn = indexRow === undefined;

  const className = React.useMemo(() => {
    return clsx(
      styles.table_column,
      indexRow % 2 ? styles.even : styles.odd,
      resizable && styles.resizable,
      isEdited && styles.edited,
      isHeaderColumn && styles.disableSelection,
    );
  }, [indexRow, resizable, isEdited]);

  const ColumnComponent = React.useMemo(() => {
    const Cp = (props) => {
      if (resizable) {
        return <ResizableContainer {...props} minWidth={minWidth} onResize={onResize} />;
      }

      if (isEditing) {
        return (
          <input
            {...props}
            autoFocus
            defaultValue={value}
            onBlur={() => onSave?.(editedValue.current)}
            onChange={(e) => {
              editedValue.current = e.target.value;
            }}
          />
        );
      }

      return <div {...props} />;
    };

    return Cp;
  }, [resizable, minWidth, isEditing]);

  const style = React.useMemo(() => {
    return {
      ...styleExternal,
      '--rowIndex': indexRow,
      '--columnIndex': columnIndex,
      '--rowHeight': `${rowHeight}px`,
    } as React.CSSProperties;
  }, [indexRow, columnIndex, rowHeight, styleExternal]);

  return (
    <ColumnComponent
      title={value}
      className={className}
      style={style}
      onDoubleClick={onDoubleClick}
    >
      {isEditing ? null : value}
    </ColumnComponent>
  );
};

export default React.memo(TableColumn);
