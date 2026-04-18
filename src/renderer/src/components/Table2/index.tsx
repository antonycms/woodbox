import React from 'react';
import useResize from '@renderer/hooks/useResize';
import useStateWithDebounce from '@renderer/hooks/useStateWithDebounce';
import { calculateTextHtmlWidth } from '@renderer/utils/methods';
import { MultiplesBarLoading } from '@renderer/components/Loaders';
import styles from './styles.module.css';
import TableRow from './components/TableRow';
import TableColumn from './components/TableColumn';
import { toCssProperties } from '@renderer/styles/theme';
import { useThemeContext } from '@renderer/contexts/Theme';
import { ModalCopy } from '../ModalCopy';
import { IColumn } from './dtos';

interface ITableProps {
  rowKeyExtractor?(rowData, index: number): React.Key;
  onContextMenu?(event: React.MouseEvent<HTMLDivElement, MouseEvent>): void;
  onScrollEnd?(): void;
  onEditRow?(indexRow: number, attribute: string, value: any): void;
  editedRows?: Map<React.Key, any>;
  rows: any[];
  columns: IColumn[];
  selectable?: boolean;
  loading?: boolean;
  onCopy?(selectedRows: any[]): void;
  onPaste?(selectedRows: any[]): void;
  onSelectRow?(rowsData: any[]): void;
  onCellLinkClick?(attribute: string, value: any): void;
}

const rowKeyExtractorDefault: ITableProps['rowKeyExtractor'] = (_, index) => index;

const Table = (props: ITableProps) => {
  const {
    columns = [],
    rows = [],
    loading,
    rowKeyExtractor = rowKeyExtractorDefault,
    selectable,
    onContextMenu,
    onScrollEnd,
    editedRows,
    onEditRow,
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
  const [selectedRows, setSelectedRows] = React.useState<Map<React.Key, any>>(new Map());
  const lastSelectedIndex = React.useRef<number>();
  const [cellEditingKey, setCellEditingKey] = React.useState<string>();
  const [scroll, setScroll] = useStateWithDebounce({ left: 0, top: 0 }, 20);
  const { height: heightBodyContainer, width: widthBodyContainer } = useResize({
    HTMLElement: refScrollContainer.current,
    ignoreZeroValue: true,
  });

  const selectedRowsRef = React.useRef(selectedRows);
  selectedRowsRef.current = selectedRows;

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

  const handleSelectRow = React.useCallback(
    (row, isSelected: boolean) => {
      const indexRow = row.__index_row;
      const keyRow = row.__key_row;

      if (!window.shiftPressed || typeof lastSelectedIndex.current !== 'number') {
        lastSelectedIndex.current = indexRow;
      }

      if (window.ctrlPressed) {
        setSelectedRows((oldMap) => {
          const newMap = new Map(oldMap);
          isSelected ? newMap.delete(keyRow) : newMap.set(keyRow, row);
          return newMap;
        });
      } //
      else if (window.shiftPressed) {
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
          onClick={selectable ? handleSelectRow : undefined}
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
                isLink={column.isLink}
                onFkCellClick={onCellLinkClick}
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
        const rows = [...selectedRowsRef.current.values()];
        setCopyData(rows);
        onCopy?.(rows);
      }
      isPaste && onPaste?.([...selectedRowsRef.current.values()]);
    };

    refScrollContainer.current?.addEventListener?.('keydown', cb);

    return () => {
      refScrollContainer.current?.removeEventListener?.('keydown', cb);
    };
  }, [onCopy, onPaste]);

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
      onContextMenu={onContextMenu}
      style={cssVars}
      tabIndex={0}
    >
      {!!loading && <MultiplesBarLoading />}

      <div className={styles.table_container}>
        {virtualHeader}
        {virtualRows}
      </div>

      {copyData !== null && <ModalCopy content={copyData} onClose={() => setCopyData(null)} />}
    </div>
  );
};

export default Table;
