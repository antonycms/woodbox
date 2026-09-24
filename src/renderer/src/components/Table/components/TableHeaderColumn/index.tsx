import React from 'react';
import type { OnResizeCallback } from '@renderer/components/ResizableContainer';
import type { IColumn, ISortDirection } from '../../dtos';
import styles from '../../styles.module.css';
import TableColumn from '../TableColumn';
import IconMdiMenuUp from '~icons/mdi/menu-up';
import IconMdiMenuDown from '~icons/mdi/menu-down';

interface ITableHeaderColumnProps<Row = unknown> {
  column: IColumn<Row>;
  columnIndex: number;
  rowHeight: number;
  width: number;
  minWidth: number;
  getSortState(column: IColumn<Row>): { sortType: ISortDirection; order?: number } | undefined;
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
  getSortState,
  onResizeColumn,
  onSort,
  onSelectColumn,
  onSortContextMenu,
}: ITableHeaderColumnProps<Row>) => {
  const canSort = !!column.sortable && !!onSort;
  const canResize = column.resizable !== false;
  const sortState = getSortState(column);
  const SortIcon = sortState?.sortType === 'DESC' ? IconMdiMenuDown : IconMdiMenuUp;

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
      title={column.title}
      columnIndex={columnIndex}
      rowHeight={rowHeight}
      resizable={canResize}
      width={width}
      onResize={canResize ? handleResize : undefined}
      onClick={handleClick}
      onContextMenu={canSort ? handleContextMenu : undefined}
      style={style}
      minWidth={minWidth}
      value={column.label}
      info={column.info}
      headerSuffix={
        sortState ? (
          <span className={styles.header_sort} aria-hidden="true">
            <SortIcon className={styles.header_sort_icon} />
            {sortState.order ? (
              <span className={styles.header_sort_order}>{sortState.order}</span>
            ) : null}
          </span>
        ) : undefined
      }
    />
  );
};

export default React.memo(TableHeaderColumn) as typeof TableHeaderColumn;
