import React from 'react';
import useResize from '@renderer/hooks/useResize';
import useStateWithDebounce from '@renderer/hooks/useStateWithDebounce';
import { calculateTextHtmlWidth } from '@renderer/utils/methods';
import { MultiplesBarLoading } from '@renderer/components/Loaders';
import styles from './styles.module.css';
import TableRow from './components/TableRow';
import TableColumn from './components/TableColumn';
import { useLatestFunc } from '@renderer/hooks/useLatestFunc';

interface IColumn {
  label: string;
  attribute: string;
  resizable?: boolean;
  sortable?: boolean;
  editable?: boolean;
  type?: 'text' | 'number' | 'select' | 'checkbox';
  renderIcon?(): JSX.Element;
}

interface ITableProps {
  rowKeyExtractor(rowData, index: number): React.Key;
  onContextMenu?(event: React.MouseEvent<HTMLDivElement, MouseEvent>): void;
  onScrollEnd?(): void;
  onEditRow?(indexRow: number, attribute: string, value: any): void;
  editedRows?: Map<React.Key, any>;
  rows: any[];
  columns: IColumn[];
  selectable?: boolean;
  loading?: boolean;
}

const Table = (props: ITableProps) => {
  const {
    columns = [],
    rows = [],
    loading,
    rowKeyExtractor,
    selectable,
    onContextMenu,
    onScrollEnd,
    editedRows,
    onEditRow,
  } = props;

  const refBodyContainer = React.useRef<HTMLDivElement>();
  const rowHeight = React.useMemo(() => 35, []);
  const maxColumnSize = React.useMemo(() => 760, []);
  const defaultColumnSize = React.useMemo(() => 200, []);
  const [columnsSize, setColumnsSize] = useStateWithDebounce<number[]>([]);
  const [minColumnsSize, setMinColumnsSize] = React.useState<number[]>([]);
  const [selectedRows, setSelectedRows] = React.useState<Map<React.Key, any>>(new Map());
  const lastSelectedIndex = React.useRef<number>();
  const [cellEditingKey, setCellEditingKey] = React.useState<string>();
  const [scroll, setScroll] = useStateWithDebounce({ left: 0, top: 0 }, 20);
  const { height: heightBodyContainer, width: widthBodyContainer } = useResize({
    HTMLElement: refBodyContainer.current,
    ignoreZeroValue: true,
  });

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

  const columnsDetails = React.useMemo(() => {
    const columnsIndexToRender: number[] = [];

    let startColumnPosition = 0;
    let endColumnPosition = 0;

    for (let i = 0; i < columnsSize.length; i++) {
      const colSize = columnsSize[i];
      endColumnPosition = startColumnPosition + colSize;

      if (startColumnPosition >= scroll.left || endColumnPosition >= scroll.left) {
        columnsIndexToRender.push(i);
      }

      startColumnPosition = endColumnPosition;

      if (startColumnPosition > widthBodyContainer + scroll.left) break;
    }

    return { columnsIndexToRender };
  }, [scroll.left, columnsSize, widthBodyContainer]);

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

  const onScroll = useLatestFunc((event: React.UIEvent<HTMLDivElement, UIEvent>) => {
    const element = event.target as HTMLDivElement;

    setScroll({ left: element.scrollLeft, top: element.scrollTop });

    const isEndVerticalScroll = element.offsetHeight + element.scrollTop > element.scrollHeight + 5;

    if (isEndVerticalScroll && element.scrollTop !== scroll.top) {
      onScrollEnd?.();
    }
  });

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
              key={column.attribute}
              columnIndex={columnIndex}
              rowHeight={rowHeight}
              width={width}
              onResize={(e) => onResize(columnIndex, e.width)}
              // onDoubleClick={onDoubleClick ? () => onDoubleClick(column) : undefined}
              minWidth={minWidth}
              value={column.label}
            />
          );
        })}
      </TableRow>
    );
  }, [columns, columnsDetails, minColumnsSize]);

  const onSelectRow = React.useCallback(
    (row, isSelected) => {
      const indexRow = row.__index_row;
      const keyRow = row.__key_row;
      const w = window as any;

      if (!w.shiftPressed || !lastSelectedIndex.current) {
        lastSelectedIndex.current = indexRow;
      }

      if (w.ctrlPressed) {
        setSelectedRows((oldMap) => {
          const newMap = new Map(oldMap);
          isSelected ? newMap.delete(keyRow) : newMap.set(keyRow, row);
          return newMap;
        });
      } //
      else if (w.shiftPressed) {
        if (typeof lastSelectedIndex.current === 'number') {
          let firstIndex = lastSelectedIndex.current;
          let lastIndex = indexRow;

          if (firstIndex > lastIndex) {
            lastIndex = firstIndex;
            firstIndex = indexRow;
          }

          setSelectedRows(() => {
            const newMap = new Map();

            for (let i = firstIndex; i < lastIndex + 1; i++) {
              const rowToSelect = serializedRows[i];
              newMap.set(rowToSelect.__key_row, rowToSelect);
            }

            return newMap;
          });
        }
      } //
      else {
        setSelectedRows((prevState) => {
          const newMap = new Map();
          (!isSelected || prevState.size > 1) && newMap.set(keyRow, row);
          return newMap;
        });
      }
    },
    [serializedRows],
  );

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

  const virtualRows = (() => {
    const { first, last } = rowsDetails;
    const { columnsIndexToRender } = columnsDetails;
    const rowsToRender = serializedRows.slice(first, last);

    return rowsToRender.map((row) => {
      const indexRow = row.__index_row;
      const styleRow = row.__style;
      const keyRow = row.__key_row;
      const isSelected = selectedRows.get(keyRow);
      const editedRow = editedRows?.get(keyRow);

      return (
        <TableRow
          key={keyRow}
          row={row}
          onClick={selectable ? onSelectRow : undefined}
          isSelected={isSelected}
        >
          {columnsIndexToRender.map((columnIndex) => {
            const column = columns[columnIndex];
            const rowColumnKey = `${keyRow}:${column.attribute}`;
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
                name={column.attribute}
                value={value}
              />
            );
          })}
        </TableRow>
      );
    });
  })();

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

  if (!columns?.length) {
    return (
      <div className={styles.table_outside_container}>{!!loading && <MultiplesBarLoading />}</div>
    );
  }

  return (
    <div
      ref={refBodyContainer}
      onScroll={onScroll}
      className={styles.table_outside_container}
      onContextMenu={onContextMenu}
    >
      {!!loading && <MultiplesBarLoading />}

      <div
        className={styles.table_container}
        style={
          {
            '--height': `${rows.length * rowHeight}px`,
            '--width': `${tableDetails.width}px`,
            '--rowHeight': `${rowHeight}px`,
            '--totalRows': rows.length,
            '--columnsSize': tableDetails.columnsSizeStr,
          } as React.CSSProperties
        }
      >
        {virtualHeader}
        {virtualRows}
      </div>
    </div>
  );
};

export default Table;
