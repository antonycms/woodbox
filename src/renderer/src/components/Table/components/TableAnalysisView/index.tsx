import React from 'react';
import type { IColumn } from '../../dtos';
import styles from '../../styles.module.css';
import { classes } from '@renderer/styles/theme';
import ResizableContainer from '@renderer/components/ResizableContainer';
import { Autocomplete } from '@renderer/components/AutocompleteBlank';
import { AutocompleteMultiBlank } from '@renderer/components/AutocompleteMultiBlank';

type TableCellEditValue = string | number | (string | number)[];

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
  onEditCell?(
    rowIndex: number,
    attribute: string,
    value: TableCellEditValue,
    keepEditing?: boolean,
  ): void;
  onSelectCell?(rowIndex: number, colIndex: number): void;
}

const serializeTableValue = (value: any, type?: IColumn['type']) => {
  if (value === undefined) return '';
  if (Array.isArray(value) && type === 'autocomplete-multi') return value.join(', ');
  if (value instanceof Date) return value.toISOString();
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
};

const TableAnalysisInput = ({
  column,
  value,
  rowIndex,
  attribute,
  onBlurCell,
  onEditCell,
}: {
  column: IColumn;
  value: any;
  rowIndex: number;
  attribute: string;
  onBlurCell?(): void;
  onEditCell?(
    rowIndex: number,
    attribute: string,
    value: TableCellEditValue,
    keepEditing?: boolean,
  ): void;
}) => {
  const editedValue = React.useRef<string | number>(serializeTableValue(value, column.type));

  const handleSaveInputValue = React.useCallback(() => {
    onBlurCell?.();

    if (serializeTableValue(value, column.type) === editedValue.current) return;

    onEditCell?.(rowIndex, attribute, editedValue.current);
  }, [attribute, column.type, onBlurCell, onEditCell, rowIndex, value]);

  if (column.type === 'autocomplete') {
    return (
      <Autocomplete
        autoFocus
        backgroundColor={'var(--backgroundColor)'}
        color={'white'}
        data={column.dataAutocomplete ?? []}
        value={value}
        name={attribute}
        containerClassName={classes(styles.analysis_value, styles.autocomplete_cell)}
        className={styles.table_autocomplete_input}
        placeholder={editedValue.current === undefined ? '' : String(editedValue.current)}
        onBlurWithoutChange={onBlurCell}
        onChange={({ value: newValue }) => {
          onBlurCell?.();
          if (newValue === null || value === newValue) return;
          onEditCell?.(rowIndex, attribute, newValue);
        }}
      />
    );
  }

  if (column.type === 'autocomplete-multi') {
    return (
      <AutocompleteMultiBlank
        autoFocus
        backgroundColor={'var(--backgroundColor)'}
        color={'white'}
        data={column.dataAutocomplete ?? []}
        value={Array.isArray(value) ? value : []}
        name={attribute}
        containerClassName={classes(styles.analysis_value, styles.autocomplete_cell)}
        className={styles.table_autocomplete_input}
        placeholder={editedValue.current === undefined ? '' : String(editedValue.current)}
        onBlurWithoutChange={onBlurCell}
        onChange={({ value: newValue }) => {
          onEditCell?.(rowIndex, attribute, newValue, true);
        }}
      />
    );
  }

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
              const isEdited = editedValue !== undefined;
              const value = isEdited ? editedValue : row[column.attribute];
              const serializedValue = serializeTableValue(value, column.type);
              const isEditing = rowColumnKey === cellEditingKey;
              const isSelected = selectedCells?.has(selectedCellKey);

              if (isEditing) {
                return (
                  <TableAnalysisInput
                    key={rowColumnKey}
                    column={column}
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
                  className={classes(
                    styles.analysis_value,
                    isEdited && styles.edited,
                    isSelected && styles.cell_selected,
                  )}
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
