import React from 'react';
import { ContextMenu, IContextMenuPosition } from '@renderer/components/ContextMenu';
import type { IColumn, ISortDirection } from '../../dtos';
import styles from '../../styles.module.css';
import TableRow from '../TableRow';
import TableColumn from '../TableColumn';
import TableHeaderColumn from '../TableHeaderColumn';
import TableRowNumber from '../TableRowNumber';
import { useI18n } from '@renderer/contexts/I18n';

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
  cellEditInitialValue?: string | number;
  selectedCells?: Set<string>;
  searchMatches?: Set<string>;
  activeSearchCellKey?: string;
  selectedRows: Map<React.Key, any>;
  columnsIndexToRender: number[];
  firstRowIndex: number;
  lastRowIndex: number;
  getSortLabel(column: IColumn<Row>): string;
  onResizeColumn(index: number, size: number): void;
  onSort?(column: IColumn<Row>, sortType?: ISortDirection | null): void;
  onDoubleClick?(rowColumnKey: string): void;
  onBlurCell?(): void;
  onEditCell?(
    rowIndex: number,
    attribute: string,
    value: TableCellEditValue,
    keepEditing?: boolean,
  ): void;
  onSelectCell?(rowIndex: number, colIndex: number): void;
  onStartCellDrag?(
    rowIndex: number,
    colIndex: number,
    event: React.MouseEvent<HTMLElement, MouseEvent>,
  ): void;
  onMoveCellDrag?(rowIndex: number, colIndex: number): void;
  onSelectColumn?(colIndex: number, event: React.MouseEvent<HTMLElement, MouseEvent>): void;
  onCellLinkClick?(attribute: string, value: any): void;
  onCellLinkPreviewClick?(attribute: string, value: any): void;
  cellLinkClickMode?: 'ctrl' | 'single';
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
  cellEditInitialValue,
  selectedCells,
  searchMatches,
  activeSearchCellKey,
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
  onStartCellDrag,
  onMoveCellDrag,
  onSelectColumn,
  onCellLinkClick,
  onCellLinkPreviewClick,
  cellLinkClickMode,
}: ITableDefaultViewProps<Row>) => {
  const { t } = useI18n();

  const [sortContextMenu, setSortContextMenu] = React.useState<{
    column: IColumn<Row>;
    position: IContextMenuPosition;
  }>();

  const rowsToRender = React.useMemo(() => {
    return rows.slice(firstRowIndex, lastRowIndex);
  }, [firstRowIndex, lastRowIndex, rows]);

  const handleSortContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>, column: IColumn<Row>) => {
      event.preventDefault();
      event.stopPropagation();

      setSortContextMenu({
        column,
        position: { x: event.clientX, y: event.clientY },
      });
    },
    [],
  );

  const handleSortMenuClick = React.useCallback(
    (sortType: ISortDirection | null) => {
      if (!sortContextMenu) return;

      onSort?.(sortContextMenu.column, sortType);
      setSortContextMenu(undefined);
    },
    [onSort, sortContextMenu],
  );

  const closeSortContextMenu = React.useCallback(() => {
    setSortContextMenu(undefined);
  }, []);

  const sortContextMenuOptions = React.useMemo(
    () => [
      {
        text: t('table.sortAsc'),
        onClick: () => handleSortMenuClick('ASC'),
      },
      {
        text: t('table.sortDesc'),
        onClick: () => handleSortMenuClick('DESC'),
      },
      {
        text: t('table.noSorting'),
        onClick: () => handleSortMenuClick(null),
      },
    ],
    [handleSortMenuClick, t],
  );

  return (
    <div className={styles.table_container}>
      <TableRow isHeader>
        <TableRowNumber isHeader />

        {columnsIndexToRender.map((columnIndex) => (
          <TableHeaderColumn
            key={String(columns[columnIndex].attribute)}
            column={columns[columnIndex]}
            columnIndex={columnIndex}
            rowHeight={rowHeight}
            width={columnsSize[columnIndex]}
            minWidth={minColumnsSize[columnIndex]}
            getSortLabel={getSortLabel}
            onResizeColumn={onResizeColumn}
            onSelectColumn={onSelectColumn}
            onSort={onSort}
            onSortContextMenu={handleSortContextMenu}
          />
        ))}
      </TableRow>

      {rowsToRender.map((row: any) => {
        const indexRow = row.__index_row;
        const keyRow = row.__key_row;
        const editedRow = editedRows?.get(keyRow);
        const newRow = newRows?.get(keyRow);

        return (
          <TableRow key={keyRow} row={row} isSelected={selectedRows.get(keyRow)}>
            <TableRowNumber indexRow={indexRow} />

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
                  editInitialValue={
                    rowColumnKey === cellEditingKey ? cellEditInitialValue : undefined
                  }
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
                  onFkCellPreviewClick={onCellLinkPreviewClick}
                  linkClickMode={cellLinkClickMode}
                  isSelectedCell={selectedCells?.has(cellKey(indexRow, columnIndex))}
                  isSearchMatch={searchMatches?.has(cellKey(indexRow, columnIndex))}
                  isActiveSearchMatch={activeSearchCellKey === cellKey(indexRow, columnIndex)}
                  onSelectCell={onSelectCell}
                  onStartCellDrag={onStartCellDrag}
                  onMoveCellDrag={onMoveCellDrag}
                />
              );
            })}
          </TableRow>
        );
      })}

      <ContextMenu
        position={sortContextMenu?.position}
        onClose={closeSortContextMenu}
        options={sortContextMenuOptions}
      />
    </div>
  );
};

export default React.memo(TableDefaultView) as typeof TableDefaultView;
