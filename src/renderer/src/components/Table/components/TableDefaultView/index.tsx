import React from 'react';
import type { IColumn } from '../../dtos';
import styles from '../../styles.module.css';
import TableRow from '../TableRow';
import TableColumn from '../TableColumn';

type TableCellEditValue = string | number | (string | number)[];

interface ITableDefaultViewProps<Row = any> {
  columns: IColumn<Row>[];
  rows: Row[];
  rowHeight: number;
  columnsSize: number[];
  minColumnsSize: number[];
  editedRows?: Map<React.Key, any>;
  newRows?: Map<React.Key, any>;
  cellEditingKey?: string;
  selectedCells?: Set<string>;
  selectedRows: Map<React.Key, any>;
  columnsIndexToRender: number[];
  firstRowIndex: number;
  lastRowIndex: number;
  getSortLabel(column: IColumn<Row>): string;
  onResizeColumn(index: number, size: number): void;
  onSort?(column: IColumn<Row>): void;
  onDoubleClick?(rowColumnKey: string): void;
  onBlurCell?(): void;
  onEditCell?(
    rowIndex: number,
    attribute: string,
    value: TableCellEditValue,
    keepEditing?: boolean,
  ): void;
  onSelectCell?(rowIndex: number, colIndex: number): void;
  onCellLinkClick?(attribute: string, value: any): void;
}

const cellKey = (rowIndex: number, colIndex: number) => `${rowIndex}:${colIndex}`;

const TableDefaultView = <Row,>({
  columns,
  rows,
  rowHeight,
  columnsSize,
  minColumnsSize,
  editedRows,
  newRows,
  cellEditingKey,
  selectedCells,
  selectedRows,
  columnsIndexToRender,
  firstRowIndex,
  lastRowIndex,
  getSortLabel,
  onResizeColumn,
  onSort,
  onDoubleClick,
  onBlurCell,
  onEditCell,
  onSelectCell,
  onCellLinkClick,
}: ITableDefaultViewProps<Row>) => {
  const rowsToRender = rows.slice(firstRowIndex, lastRowIndex);

  return (
    <div className={styles.table_container}>
      <TableRow isHeader>
        {columnsIndexToRender.map((columnIndex) => {
          const column = columns[columnIndex];

          return (
            <TableColumn
              resizable
              title={column.title}
              key={String(column.attribute)}
              columnIndex={columnIndex}
              rowHeight={rowHeight}
              width={columnsSize[columnIndex]}
              onResize={(e) => onResizeColumn(columnIndex, e.width)}
              onClick={column.sortable && onSort ? () => onSort(column) : undefined}
              style={{ cursor: column.sortable && onSort ? 'pointer' : undefined }}
              minWidth={minColumnsSize[columnIndex]}
              value={getSortLabel(column)}
            />
          );
        })}
      </TableRow>

      {rowsToRender.map((row: any) => {
        const indexRow = row.__index_row;
        const keyRow = row.__key_row;
        const editedRow = editedRows?.get(keyRow);
        const newRow = newRows?.get(keyRow);

        return (
          <TableRow key={keyRow} row={row} isSelected={selectedRows.get(keyRow)}>
            {columnsIndexToRender.map((columnIndex) => {
              const column = columns[columnIndex];
              const rowColumnKey = `${keyRow}:${String(column.attribute)}`;
              const editedValue = editedRow?.[column.attribute];
              const newValue = newRow?.[column.attribute];
              const isEdited = editedValue !== undefined;
              const hasNewValue = newValue !== undefined;
              const value = hasNewValue ? newValue : isEdited ? editedValue : row[column.attribute];

              return (
                <TableColumn
                  key={rowColumnKey}
                  rowColumnKey={rowColumnKey}
                  columnIndex={columnIndex}
                  indexRow={indexRow}
                  rowHeight={rowHeight}
                  style={row.__style}
                  isEdited={isEdited}
                  isEditing={rowColumnKey === cellEditingKey}
                  onDoubleClick={onDoubleClick}
                  onEditCell={onEditCell}
                  onBlurCell={onBlurCell}
                  width={columnsSize[columnIndex]}
                  name={String(column.attribute)}
                  value={value}
                  type={column.type}
                  dataAutocomplete={column.dataAutocomplete}
                  isLink={column.isLink}
                  onFkCellClick={onCellLinkClick}
                  isSelectedCell={selectedCells?.has(cellKey(indexRow, columnIndex))}
                  onSelectCell={onSelectCell}
                />
              );
            })}
          </TableRow>
        );
      })}
    </div>
  );
};

export default React.memo(TableDefaultView) as typeof TableDefaultView;
