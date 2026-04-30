import React from 'react';
import type { IColumn } from '../../dtos';
import styles from '../../styles.module.css';
import { classes } from '@renderer/styles/theme';

interface ITableAnalysisViewProps<Row = any> {
  columns: IColumn<Row>[];
  rows: Row[];
  rowHeight: number;
  editedRows?: Map<React.Key, any>;
  cellEditingKey?: string;
  selectedCells?: Set<string>;
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
  editedRows,
  cellEditingKey,
  selectedCells,
  onDoubleClick,
  onBlurCell,
  onEditCell,
  onSelectCell,
}: ITableAnalysisViewProps) => {
  return (
    <div
      className={styles.analysis_container}
      style={{ '--rowHeight': `${rowHeight}px` } as React.CSSProperties}
    >
      <div className={styles.analysis_grid}>
        <div className={styles.analysis_header}>Coluna</div>

        {rows.map((row: any) => (
          <div className={styles.analysis_header} key={row.__key_row}>
            Linha #{Number(row.__index_row) + 1}
          </div>
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
