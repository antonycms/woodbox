import React from 'react';
import type { IColumn } from '../../dtos';
import styles from '../../styles.module.css';
import { classes } from '@renderer/styles/theme';
import ResizableContainer from '@renderer/components/ResizableContainer';

interface ITableAnalysisViewProps<Row = any> {
  columns: IColumn<Row>[];
  rows: Row[];
  rowHeight: number;
  columnsSize: number[];
  minColumnsSize: number[];
  editedRows?: Map<React.Key, any>;
  cellEditingKey?: string;
  selectedCells?: Set<string>;
  onResizeColumn?(index: number, size: number): void;
  onDoubleClick?(rowColumnKey: string): void;
  onBlurCell?(): void;
  onEditCell?(rowIndex: number, attribute: string, value: string | number): void;
  onSelectCell?(rowIndex: number, colIndex: number): void;
}

const serializeTableValue = (value: any) => {
  if (value === undefined) return '';
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const TableAnalysisInput = ({
  value,
  rowIndex,
  attribute,
  onBlurCell,
  onEditCell,
}: {
  value: any;
  rowIndex: number;
  attribute: string;
  onBlurCell?(): void;
  onEditCell?(rowIndex: number, attribute: string, value: string | number): void;
}) => {
  const editedValue = React.useRef<string | number>(serializeTableValue(value));

  const handleSaveInputValue = React.useCallback(() => {
    onBlurCell?.();

    if (serializeTableValue(value) === editedValue.current) return;

    onEditCell?.(rowIndex, attribute, editedValue.current);
  }, [attribute, onBlurCell, onEditCell, rowIndex, value]);

  return (
    <input
      className={styles.analysis_value}
      autoFocus
      spellCheck={false}
      defaultValue={editedValue.current}
      onBlur={handleSaveInputValue}
      onChange={(e) => {
        editedValue.current = e.target.value;
      }}
    />
  );
};

const TableAnalysisView = ({
  columns,
  rows,
  rowHeight,
  columnsSize,
  minColumnsSize,
  editedRows,
  cellEditingKey,
  selectedCells,
  onResizeColumn,
  onDoubleClick,
  onBlurCell,
  onEditCell,
  onSelectCell,
}: ITableAnalysisViewProps) => {
  const columnsSizeStyle = columnsSize.map((size) => `${size}px`).join(' ');

  return (
    <div
      className={styles.analysis_container}
      style={{ '--rowHeight': `${rowHeight}px` } as React.CSSProperties}
    >
      <div
        className={styles.analysis_grid}
        style={{ '--analysisColumnsSize': columnsSizeStyle } as React.CSSProperties}
      >
        <ResizableContainer
          className={styles.analysis_header}
          width={columnsSize[0]}
          minWidth={minColumnsSize[0]}
          height={rowHeight}
          onResize={(size) => onResizeColumn?.(0, size.width || 0)}
        >
          Coluna
        </ResizableContainer>

        {rows.map((row: any, rowIndex) => (
          <ResizableContainer
            className={styles.analysis_header}
            key={row.__key_row}
            width={columnsSize[rowIndex + 1]}
            minWidth={minColumnsSize[rowIndex + 1]}
            height={rowHeight}
            onResize={(size) => onResizeColumn?.(rowIndex + 1, size.width || 0)}
          >
            Linha #{Number(row.__index_row) + 1}
          </ResizableContainer>
        ))}

        {columns.map((column, columnIndex) => (
          <React.Fragment key={String(column.attribute)}>
            <div className={styles.analysis_field} title={column.label}>
              {column.label}
            </div>

            {rows.map((row: any) => {
              const keyRow = row.__key_row;
              const attribute = String(column.attribute);
              const rowColumnKey = `${keyRow}:${attribute}`;
              const selectedCellKey = `${row.__index_row}:${columnIndex}`;
              const editedRow = editedRows?.get(keyRow);
              const editedValue = editedRow?.[column.attribute];
              const value = editedValue !== undefined ? editedValue : row[column.attribute];
              const serializedValue = serializeTableValue(value);
              const isEditing = rowColumnKey === cellEditingKey;
              const isSelected = selectedCells?.has(selectedCellKey);

              if (isEditing) {
                return (
                  <TableAnalysisInput
                    key={rowColumnKey}
                    value={value}
                    rowIndex={row.__index_row}
                    attribute={attribute}
                    onBlurCell={onBlurCell}
                    onEditCell={onEditCell}
                  />
                );
              }

              return (
                <div
                  className={classes(styles.analysis_value, isSelected && styles.cell_selected)}
                  key={rowColumnKey}
                  title={serializedValue}
                  onDoubleClick={() => onDoubleClick?.(rowColumnKey)}
                  onClick={() => onSelectCell?.(row.__index_row, columnIndex)}
                >
                  {serializedValue}
                </div>
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default React.memo(TableAnalysisView);
