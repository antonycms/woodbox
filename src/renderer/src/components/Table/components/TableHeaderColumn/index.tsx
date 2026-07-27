import React from 'react';
import type { OnResizeCallback } from '@renderer/components/ResizableContainer';
import type { IColumn, ISortDirection } from '../../dtos';
import TableColumn from '../TableColumn';

interface ITableHeaderColumnProps<Row = unknown> {
  column: IColumn<Row>;
  columnIndex: number;
  rowHeight: number;
  width: number;
  minWidth: number;
  getSortLabel(column: IColumn<Row>): string;
  onResizeColumn(index: number, size: number): void;
  onSort?(column: IColumn<Row>, sortType?: ISortDirection | null): void;
  onSelectColumn?(colIndex: number, event: React.MouseEvent<HTMLElement, MouseEvent>): void;
  onSortContextMenu(
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    column: IColumn<Row>,
  ): void;
}

const TableHeaderColumn = <Row,>({
  column,
  columnIndex,
  rowHeight,
  width,
  minWidth,
  getSortLabel,
  onResizeColumn,
  onSort,
  onSelectColumn,
  onSortContextMenu,
}: ITableHeaderColumnProps<Row>) => {
  const canSort = !!column.sortable && !!onSort;

  const style = React.useMemo(
    () => ({ cursor: canSort ? 'pointer' : undefined }),
    [canSort],
  );

  const handleResize = React.useCallback<OnResizeCallback>(
    (event) => {
      if (event.width === undefined) return;

      onResizeColumn(columnIndex, event.width);
    },
    [columnIndex, onResizeColumn],
  );

  const handleClick = React.useCallback(
    (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      onSelectColumn?.(columnIndex, event);
    },
    [columnIndex, onSelectColumn],
  );

  const handleContextMenu = React.useCallback(
    (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
      if (!canSort) return;

      onSortContextMenu(event, column);
    },
    [canSort, column, onSortContextMenu],
  );

  return (
    <TableColumn
      resizable
      title={column.title}
      columnIndex={columnIndex}
      rowHeight={rowHeight}
      width={width}
      onResize={handleResize}
      onClick={handleClick}
      onContextMenu={canSort ? handleContextMenu : undefined}
      style={style}
      minWidth={minWidth}
      value={getSortLabel(column)}
    />
  );
};

export default React.memo(TableHeaderColumn) as typeof TableHeaderColumn;
