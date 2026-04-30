import React from 'react';
import useResize from '@renderer/hooks/useResize';
import useStateWithDebounce from '@renderer/hooks/useStateWithDebounce';
import { calculateTextHtmlWidth, copyToClipboard } from '@renderer/utils/methods';
import { MultiplesBarLoading } from '@renderer/components/Loaders';
import styles from './styles.module.css';
import TableRow from './components/TableRow';
import TableColumn from './components/TableColumn';
import { toCssProperties } from '@renderer/styles/theme';
import { useThemeContext } from '@renderer/contexts/Theme';
import type { IColumn, ITableSort } from './dtos';

interface ITableProps<Row = any> {
  rowKeyExtractor?(rowData: Row, index: number): React.Key;
  onContextMenu?(
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    data: { cellsText: string; rowsText: string; rowsJson: string },
  ): void;
  onScrollEnd?(): void;
  onEditRow?(indexRow: number, attribute: string, value: any): void;
  editedRows?: Map<React.Key, any>;
  rows: Row[];
  columns: IColumn<Row>[];
  sort?: ITableSort[];
  onSort?(column: IColumn<Row>): void;
  loading?: boolean;
  onCopy?(selectedRows: Row[]): void;
  onPaste?(selectedRows: Row[]): void;
  onSelectRow?(selectedRows: Row[]): void;
  onCellLinkClick?(attribute: string, value: any): void;
}

const rowKeyExtractorDefault: ITableProps['rowKeyExtractor'] = (_, index) => index;

const cellKey = (rowIndex: number, colIndex: number) => `${rowIndex}:${colIndex}`;

function Table<Row = any>(props: ITableProps<Row>) {
  const {
    columns = [],
    rows = [],
    loading,
    rowKeyExtractor = rowKeyExtractorDefault,
    onContextMenu,
    onScrollEnd,
    editedRows,
    onEditRow,
    sort,
    onSort,
    onSelectRow,
    onCopy,
    onPaste,
    onCellLinkClick,
  } = props;

  const {
    activeTheme: { table: theme },
  } = useThemeContext();
  const refScrollContainer = React.useRef<HTMLDivElement>();
  const rowHeight = React.useMemo(() => 35, []);
  const maxColumnSize = React.useMemo(() => 760, []);
  const defaultColumnSize = React.useMemo(() => 200, []);
  const [columnsSize, setColumnsSize] = useStateWithDebounce<number[]>([]);
  const [minColumnsSize, setMinColumnsSize] = React.useState<number[]>([]);
  const [cellEditingKey, setCellEditingKey] = React.useState<string>();
  const [selectedCells, setSelectedCells] = React.useState<Set<string>>(new Set());
  const lastSelectedCellRef = React.useRef<{ rowIndex: number; colIndex: number } | null>(null);
  const arrowCursorRef = React.useRef<{ rowIndex: number; colIndex: number } | null>(null);
  const [scroll, setScroll] = useStateWithDebounce({ left: 0, top: 0 }, 20);
  const { height: heightBodyContainer, width: widthBodyContainer } = useResize({
    HTMLElement: refScrollContainer.current,
    ignoreZeroValue: true,
  });

  const cellEditingKeyRef = React.useRef(cellEditingKey);
  cellEditingKeyRef.current = cellEditingKey;
  const columnsRef = React.useRef(columns);
  columnsRef.current = columns;
  const columnsSizeRef = React.useRef(columnsSize);
  columnsSizeRef.current = columnsSize;

  const [copyData, setCopyData] = React.useState<any[]>(null);

  const serializedRows = React.useMemo(() => {
    return rows.map((row, index) => {
      const keyRow = rowKeyExtractor(row, index);

      return {
        ...row,
        __index_row: index,
        __key_row: keyRow,
      };
    });
  }, [rows]);

  const serializedRowsRef = React.useRef(serializedRows);
  serializedRowsRef.current = serializedRows;

  const selectedCellsRef = React.useRef(selectedCells);
  selectedCellsRef.current = selectedCells;

  const selectedRows = React.useMemo(() => {
    const map = new Map<React.Key, any>();
    selectedCells.forEach((key) => {
      const rowIndex = parseInt(key.split(':')[0], 10);
      const row = serializedRows[rowIndex];
      if (row) map.set(row.__key_row, row);
    });
    return map;
  }, [selectedCells, serializedRows]);

  const selectedRowsRef = React.useRef(selectedRows);
  selectedRowsRef.current = selectedRows;

  const columnsDetails = React.useMemo(() => {
    const columnsIndexToRender: number[] = [];
    const length = Math.min(columnsSize.length, columns.length);

    let startColumnPosition = 0;
    let endColumnPosition = 0;

    for (let i = 0; i < length; i++) {
      const colSize = columnsSize[i];
      endColumnPosition = startColumnPosition + colSize;

      if (startColumnPosition >= scroll.left || endColumnPosition >= scroll.left) {
        columnsIndexToRender.push(i);
      }

      startColumnPosition = endColumnPosition;

      if (startColumnPosition > widthBodyContainer + scroll.left) break;
    }

    return { columnsIndexToRender };
  }, [scroll.left, columnsSize, widthBodyContainer, columns]);

  const rowsDetails = (() => {
    const numberOfRowsToShowOnScreen = heightBodyContainer / rowHeight;

    let first = Math.ceil(scroll.top / rowHeight);
    let last = first + numberOfRowsToShowOnScreen;

    last = first + numberOfRowsToShowOnScreen + 4;
    first = first < 5 ? 0 : first - 4;

    return { first, last };
  })();

  const tableDetails = React.useMemo(() => {
    let width = 0;
    let columnsSizeStr = '';

    columnsSize.forEach((size) => {
      width += size;
      columnsSizeStr += ` ${size}px`;
    });

    return { width, columnsSizeStr };
  }, [columnsSize]);

  const onResize = React.useCallback((index: number, size: number) => {
    const minSizeAllowed = minColumnsSize[index];
    let allowedSize = size;

    if (size <= minSizeAllowed) {
      allowedSize = minSizeAllowed;
    } //
    else if (allowedSize > maxColumnSize) {
      allowedSize = maxColumnSize;
    }

    setColumnsSize((prevState) => {
      const nextState = [...prevState];

      nextState[index] = allowedSize;

      return nextState;
    });
  }, []);

  const checkScrollEnd = React.useCallback(() => {
    const element = refScrollContainer.current;
    if (!element || !onScrollEnd) return;

    const hasHorizontalScrollbar = element.scrollWidth > element.clientWidth;
    const scrollbarSize = 6;
    const scrollHeight = element.scrollHeight + (hasHorizontalScrollbar ? scrollbarSize : 0);
    const isEndVerticalScroll = Math.ceil(element.offsetHeight + element.scrollTop) >= scrollHeight;

    if (isEndVerticalScroll) {
      onScrollEnd();
    }
  }, [onScrollEnd]);

  const onScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement, UIEvent>) => {
      checkScrollEnd();
      setScroll({ left: event.currentTarget.scrollLeft, top: event.currentTarget.scrollTop });
    },
    [checkScrollEnd],
  );

  const getSortLabel = React.useCallback(
    (column: IColumn<Row>) => {
      const sortIndex = sort?.findIndex((item) => item.columnName === column.attribute) ?? -1;
      if (sortIndex === -1) return column.label;

      const sortItem = sort[sortIndex];
      const icon = sortItem.sortType === 'ASC' ? '▲' : '▼';
      const order = sort.length > 1 ? ` ${sortIndex + 1}` : '';

      return `${column.label} ${icon}${order}`;
    },
    [sort],
  );

  const virtualHeader = React.useMemo(() => {
    const { columnsIndexToRender } = columnsDetails;
    return (
      <TableRow isHeader>
        {columnsIndexToRender.map((columnIndex) => {
          const column = columns[columnIndex];
          const minWidth = minColumnsSize[columnIndex];
          const width = columnsSize[columnIndex];

          return (
            <TableColumn
              resizable
              title={column.title}
              key={String(column.attribute)}
              columnIndex={columnIndex}
              rowHeight={rowHeight}
              width={width}
              onResize={(e) => onResize(columnIndex, e.width)}
              onClick={column.sortable && onSort ? () => onSort(column) : undefined}
              style={{ cursor: column.sortable && onSort ? 'pointer' : undefined }}
              // onDoubleClick={onDoubleClick ? () => onDoubleClick(column) : undefined}
              minWidth={minWidth}
              value={getSortLabel(column)}
            />
          );
        })}
      </TableRow>
    );
  }, [columns, columnsDetails, getSortLabel, minColumnsSize, onSort]);

  const onSaveCell = React.useCallback(
    (indexRow: number, rowColumnKey: string, newValue: string | number) => {
      setCellEditingKey(null);
      onEditRow?.(indexRow, rowColumnKey, newValue);
    },
    [],
  );

  const onBlurCell = React.useCallback(() => {
    setCellEditingKey(null);
  }, []);

  const handleSelectCell = React.useCallback((rowIndex: number, colIndex: number) => {
    if (!window.shiftPressed || !lastSelectedCellRef.current) {
      lastSelectedCellRef.current = { rowIndex, colIndex };
    }
    arrowCursorRef.current = { rowIndex, colIndex };

    if (window.ctrlPressed) {
      setSelectedCells((prev) => {
        const next = new Set(prev);
        const key = cellKey(rowIndex, colIndex);
        next.has(key) ? next.delete(key) : next.add(key);
        return next;
      });
    } else if (window.shiftPressed && lastSelectedCellRef.current) {
      const anchor = lastSelectedCellRef.current;
      const minRow = Math.min(anchor.rowIndex, rowIndex);
      const maxRow = Math.max(anchor.rowIndex, rowIndex);
      const minCol = Math.min(anchor.colIndex, colIndex);
      const maxCol = Math.max(anchor.colIndex, colIndex);
      setSelectedCells(() => {
        const next = new Set<string>();
        for (let r = minRow; r <= maxRow; r++)
          for (let c = minCol; c <= maxCol; c++) next.add(cellKey(r, c));
        return next;
      });
    } else {
      setSelectedCells(new Set([cellKey(rowIndex, colIndex)]));
    }
  }, []);

  const virtualRows = (() => {
    const { first, last } = rowsDetails;
    const { columnsIndexToRender } = columnsDetails;
    const rowsToRender = serializedRows.slice(first, last);

    return rowsToRender.map((row: any) => {
      const indexRow = row.__index_row;
      const styleRow = row.__style;
      const keyRow = row.__key_row;
      const isSelected = selectedRows.get(keyRow);
      const editedRow = editedRows?.get(keyRow);

      return (
        <TableRow key={keyRow} row={row} isSelected={isSelected}>
          {columnsIndexToRender.map((columnIndex) => {
            const column = columns[columnIndex];
            const rowColumnKey = `${keyRow}:${String(column.attribute)}`;
            const isEditing = rowColumnKey === cellEditingKey;
            const width = columnsSize[columnIndex];
            const editedValue = editedRow?.[column.attribute];
            const value = editedValue !== undefined ? editedValue : row[column.attribute];

            return (
              <TableColumn
                key={rowColumnKey}
                rowColumnKey={rowColumnKey}
                columnIndex={columnIndex}
                indexRow={indexRow}
                rowHeight={rowHeight}
                style={styleRow}
                isEditing={isEditing}
                onDoubleClick={setCellEditingKey}
                onEditCell={onSaveCell}
                onBlurCell={onBlurCell}
                width={width}
                name={String(column.attribute)}
                value={value}
                isLink={column.isLink}
                onFkCellClick={onCellLinkClick}
                isSelectedCell={selectedCells.has(cellKey(indexRow, columnIndex))}
                onSelectCell={handleSelectCell}
              />
            );
          })}
        </TableRow>
      );
    });
  })();

  const cssVars = toCssProperties({
    ...theme,
    height: `${rows.length * rowHeight}px`,
    width: `${tableDetails.width}px`,
    rowHeight: `${rowHeight}px`,
    totalRows: rows.length,
    columnsSize: tableDetails.columnsSizeStr,
  });

  React.useEffect(() => {
    const cb = (ev: KeyboardEvent) => {
      const isCopy = window.ctrlPressed && ev.key === 'c';
      const isPaste = window.ctrlPressed && ev.key === 'v';

      if (isCopy) {
        const cells = selectedCellsRef.current;
        if (cells.size > 0) {
          const rowMap = new Map<number, number[]>();

          cells.forEach((key) => {
            const [r, c] = key.split(':').map(Number);
            if (!rowMap.has(r)) rowMap.set(r, []);
            rowMap.get(r)!.push(c);
          });

          const lines = [...rowMap.entries()]
            .sort((a, b) => a[0] - b[0])
            .map(([rowIndex, colIndices]) => {
              colIndices.sort((a, b) => a - b);
              return colIndices
                .map((colIndex) => {
                  const row = serializedRowsRef.current[rowIndex];
                  const col = columnsRef.current[colIndex];
                  const value = row?.[col?.attribute];
                  return value === undefined
                    ? ''
                    : typeof value === 'object'
                    ? JSON.stringify(value)
                    : String(value);
                })
                .join(', ');
            });

          copyToClipboard(lines.join('\n'));
        }
      }
      isPaste && onPaste?.([...selectedRowsRef.current.values()]);
    };

    refScrollContainer.current?.addEventListener?.('keydown', cb);

    return () => {
      refScrollContainer.current?.removeEventListener?.('keydown', cb);
    };
  }, [onCopy, onPaste]);

  React.useEffect(() => {
    const cb = (ev: KeyboardEvent) => {
      const anchor = lastSelectedCellRef.current;
      if (!anchor || cellEditingKeyRef.current) return;

      const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.key);
      if (!isArrow) return;

      ev.preventDefault();

      const totalRows = serializedRowsRef.current.length;
      const totalCols = columnsRef.current.length;
      const cursor = arrowCursorRef.current ?? anchor;
      let { rowIndex, colIndex } = cursor;

      if (ev.key === 'ArrowUp') rowIndex = Math.max(0, rowIndex - 1);
      else if (ev.key === 'ArrowDown') rowIndex = Math.min(totalRows - 1, rowIndex + 1);
      else if (ev.key === 'ArrowLeft') colIndex = Math.max(0, colIndex - 1);
      else if (ev.key === 'ArrowRight') colIndex = Math.min(totalCols - 1, colIndex + 1);

      arrowCursorRef.current = { rowIndex, colIndex };

      if (ev.shiftKey) {
        const minRow = Math.min(anchor.rowIndex, rowIndex);
        const maxRow = Math.max(anchor.rowIndex, rowIndex);
        const minCol = Math.min(anchor.colIndex, colIndex);
        const maxCol = Math.max(anchor.colIndex, colIndex);
        setSelectedCells(() => {
          const next = new Set<string>();
          for (let r = minRow; r <= maxRow; r++)
            for (let c = minCol; c <= maxCol; c++) next.add(cellKey(r, c));
          return next;
        });
      } else {
        lastSelectedCellRef.current = { rowIndex, colIndex };
        setSelectedCells(new Set([cellKey(rowIndex, colIndex)]));
      }

      const container = refScrollContainer.current;
      if (!container) return;

      const cellTop = rowIndex * rowHeight;
      const cellBottom = cellTop + rowHeight;
      if (cellTop < container.scrollTop) {
        container.scrollTop = cellTop;
      } else if (cellBottom > container.scrollTop + container.clientHeight) {
        container.scrollTop = cellBottom - container.clientHeight;
      }

      const sizes = columnsSizeRef.current;
      let colStart = 0;
      for (let i = 0; i < colIndex; i++) colStart += sizes[i] || 0;
      const colEnd = colStart + (sizes[colIndex] || 0);
      if (colStart < container.scrollLeft) {
        container.scrollLeft = colStart;
      } else if (colEnd > container.scrollLeft + container.clientWidth) {
        container.scrollLeft = colEnd - container.clientWidth;
      }
    };

    refScrollContainer.current?.addEventListener?.('keydown', cb);
    return () => {
      refScrollContainer.current?.removeEventListener?.('keydown', cb);
    };
  }, []);

  React.useEffect(() => {
    const defaultColumnsSize = columns.map((column) => {
      return Math.ceil(calculateTextHtmlWidth(column.label) + 40);
    });

    if (columnsSize.length !== columns.length) {
      setColumnsSize(
        defaultColumnsSize.map((size) => (size > defaultColumnSize ? size : defaultColumnSize)),
      );
    }

    setMinColumnsSize(defaultColumnsSize);
  }, [columns]);

  React.useEffect(() => {
    onSelectRow?.([...selectedRows.values()]);
  }, [selectedRows]);

  return (
    <div
      ref={refScrollContainer}
      onScroll={onScroll}
      className={styles.table_outside_container}
      onContextMenu={(event) => {
        if (!onContextMenu) return;

        const cells = selectedCellsRef.current;
        const rowMap = new Map<number, number[]>();

        cells.forEach((key) => {
          const [r, c] = key.split(':').map(Number);
          if (!rowMap.has(r)) rowMap.set(r, []);
          rowMap.get(r)!.push(c);
        });

        const cellLines = [...rowMap.entries()]
          .sort((a, b) => a[0] - b[0])
          .map(([rowIndex, colIndices]) => {
            colIndices.sort((a, b) => a - b);
            return colIndices
              .map((ci) => {
                const v = serializedRowsRef.current[rowIndex]?.[columnsRef.current[ci]?.attribute];
                return v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
              })
              .join(', ');
          });

        const rowLines = [...rowMap.keys()]
          .sort((a, b) => a - b)
          .map((rowIndex) => {
            const row = serializedRowsRef.current[rowIndex];
            return columnsRef.current
              .map((col) => {
                const v = row?.[col.attribute];
                return v === undefined ? '' : typeof v === 'object' ? JSON.stringify(v) : String(v);
              })
              .join(', ');
          });

        const sortedRowIndices = [...rowMap.keys()].sort((a, b) => a - b);

        const rowObjects = sortedRowIndices.map((rowIndex) => {
          const row = serializedRowsRef.current[rowIndex];
          return Object.fromEntries(
            columnsRef.current.map((col) => [col.attribute, row?.[col.attribute] ?? null]),
          );
        });

        const rowsJson =
          rowObjects.length === 1
            ? JSON.stringify(rowObjects[0], null, 2)
            : JSON.stringify(rowObjects, null, 2);

        onContextMenu(event, {
          cellsText: cellLines.join('\n'),
          rowsText: rowLines.join('\n'),
          rowsJson,
        });
      }}
      style={cssVars}
      tabIndex={0}
    >
      {!!loading && <MultiplesBarLoading />}

      <div className={styles.table_container}>
        {virtualHeader}
        {virtualRows}
      </div>
    </div>
  );
}

export default Table;
