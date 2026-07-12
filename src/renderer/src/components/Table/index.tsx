import React from 'react';
import useResize from '@renderer/hooks/useResize';
import useDebounce from '@renderer/hooks/useDebounce';
import { calculateTextHtmlWidth, copyToClipboard } from '@renderer/utils/methods';
import { MultiplesBarLoading } from '@renderer/components/Loaders';
import styles from './styles.module.css';
import TableAnalysisView from './components/TableAnalysisView';
import TableDefaultView from './components/TableDefaultView';
import { toCssProperties } from '@renderer/styles/theme';
import { useThemeContext } from '@renderer/contexts/Theme';
import type { IColumn, ISortDirection, ITableSort } from './dtos';

type TableCellEditValue = string | number | (string | number)[];
type TableScrollState = { left: number; top: number };
type TableCellPosition = { rowIndex: number; colIndex: number };
type TableDragSelectionState = {
  mode: 'default' | 'analysis';
  anchor: TableCellPosition;
  hasMoved: boolean;
};

export interface ITableContextMenuData {
  cellsText: string;
  rowsText: string;
  rowsJson: string;
  rows: Record<string, any>[];
  selectedCellRows: Record<string, any>[];
}

export interface ITableSelectedCellData<Row = any> {
  row: Row;
  column: IColumn<Row>;
  value: any;
  rowIndex: number;
  colIndex: number;
}

interface ITableProps<Row = any> {
  rowKeyExtractor?(rowData: Row, index: number): React.Key;
  onContextMenu?(
    event: React.MouseEvent<HTMLDivElement, MouseEvent>,
    data: ITableContextMenuData,
  ): void;
  onScrollEnd?(): void;
  onEditRow?(indexRow: number, attribute: string, value: any, rowKey?: React.Key): void;
  onEditNewRow?(rowKey: React.Key, attribute: string, value: any): void;
  editedRows?: Map<React.Key, any>;
  newRows?: Map<React.Key, any>;
  rows: Row[];
  columns: IColumn<Row>[];
  sort?: ITableSort[];
  onSort?(column: IColumn<Row>, sortType?: ISortDirection | null): void;
  loading?: boolean;
  onSelectRow?(selectedRows: Row[]): void;
  onSelectCellData?(data: ITableSelectedCellData<Row>): void;
  onCellLinkClick?(attribute: string, value: any): void;
  onCellLinkPreviewClick?(attribute: string, value: any): void;
  cellLinkClickMode?: 'ctrl' | 'single';
}

const rowKeyExtractorDefault: ITableProps['rowKeyExtractor'] = (_, index) => index;

const cellKey = (rowIndex: number, colIndex: number) => `${rowIndex}:${colIndex}`;

const parseClipboardGrid = (text: string) => {
  const normalizedText = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');

  return normalizedText.split('\n').map((line) => line.split('\t'));
};

function Table<Row = any>(props: ITableProps<Row>) {
  const {
    columns = [],
    rows = [],
    loading,
    rowKeyExtractor = rowKeyExtractorDefault,
    onContextMenu,
    onScrollEnd,
    editedRows,
    newRows,
    onEditRow,
    onEditNewRow,
    sort,
    onSort,
    onSelectRow,
    onSelectCellData,
    onCellLinkClick,
    onCellLinkPreviewClick,
    cellLinkClickMode = 'ctrl',
  } = props;

  const {
    activeTheme: { table: theme },
  } = useThemeContext();
  const refScrollContainer = React.useRef<HTMLDivElement>(null);
  const rowHeight = React.useMemo(() => 35, []);
  const maxColumnSize = React.useMemo(() => 760, []);
  const defaultColumnSize = React.useMemo(() => 200, []);
  const rowNumberColumnWidth = React.useMemo(() => 56, []);
  const [columnsSize, setColumnsSize] = React.useState<number[]>([]);
  const [minColumnsSize, setMinColumnsSize] = React.useState<number[]>([]);
  const [cellEditingKey, setCellEditingKey] = React.useState<string>();
  const [cellEditInitialValue, setCellEditInitialValue] = React.useState<string | number>();
  const [analysisMode, setAnalysisMode] = React.useState(false);
  const [analysisRows, setAnalysisRows] = React.useState<any[]>([]);
  const [analysisColumnsSize, setAnalysisColumnsSize] = React.useState<number[]>([]);
  const [analysisMinColumnsSize, setAnalysisMinColumnsSize] = React.useState<number[]>([]);
  const [analysisSelectedCells, setAnalysisSelectedCells] = React.useState<Set<string>>(new Set());
  const [selectedCells, setSelectedCells] = React.useState<Set<string>>(new Set());
  const lastSelectedCellRef = React.useRef<{ rowIndex: number; colIndex: number } | null>(null);
  const lastAnalysisSelectedCellRef = React.useRef<{ rowIndex: number; colIndex: number } | null>(
    null,
  );
  const dragSelectionRef = React.useRef<TableDragSelectionState | null>(null);
  const ignoreNextClickRef = React.useRef(false);
  const analysisArrowCursorRef = React.useRef<{ rowIndex: number; colIndex: number } | null>(null);
  const arrowCursorRef = React.useRef<{ rowIndex: number; colIndex: number } | null>(null);
  const [scroll, setScroll] = React.useState<TableScrollState>({ left: 0, top: 0 });
  const setScrollDebounced = useDebounce<React.Dispatch<React.SetStateAction<TableScrollState>>>(
    setScroll,
    20,
  );
  const defaultScrollRef = React.useRef<TableScrollState>({ left: 0, top: 0 });
  const { height: heightBodyContainer, width: widthBodyContainer } = useResize({
    HTMLElement: refScrollContainer.current,
    ignoreZeroValue: true,
  });

  const cellEditingKeyRef = React.useRef(cellEditingKey);
  cellEditingKeyRef.current = cellEditingKey;
  const analysisModeRef = React.useRef(analysisMode);
  analysisModeRef.current = analysisMode;
  const columnsRef = React.useRef(columns);
  columnsRef.current = columns;
  const columnsSizeRef = React.useRef(columnsSize);
  columnsSizeRef.current = columnsSize;

  const serializedRows = React.useMemo(() => {
    const newRowsLength = newRows?.size ?? 0;

    const serializedNewRows = [...(newRows?.entries() ?? [])].map(([keyRow, row], index) => ({
      ...row,
      __index_row: index,
      __row_index: index,
      __key_row: keyRow,
      __is_new_row: true,
      __style: { backgroundColor: '#61ffca', color: '#1c1b22' },
    }));

    const serializedRows = rows.map((row, index) => {
      const keyRow = rowKeyExtractor(row, index);

      return {
        ...row,
        __index_row: index + newRowsLength,
        __row_index: index,
        __key_row: keyRow,
      };
    });

    return [...serializedNewRows, ...serializedRows];
  }, [rows, newRows]);

  const serializedRowsRef = React.useRef(serializedRows);
  serializedRowsRef.current = serializedRows;

  const selectedCellsRef = React.useRef(selectedCells);
  selectedCellsRef.current = selectedCells;
  const analysisSelectedCellsRef = React.useRef(analysisSelectedCells);
  analysisSelectedCellsRef.current = analysisSelectedCells;
  const analysisRowsRef = React.useRef(analysisRows);
  analysisRowsRef.current = analysisRows;
  const analysisColumnsSizeRef = React.useRef(analysisColumnsSize);
  analysisColumnsSizeRef.current = analysisColumnsSize;
  const analysisModeEnterRef = React.useRef(analysisMode);
  analysisModeEnterRef.current = analysisMode;

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

  const columnsSignature = React.useMemo(
    () => columns.map((column) => String(column.attribute)).join('\0'),
    [columns],
  );

  const columnsDetails = React.useMemo(() => {
    const columnsIndexToRender: number[] = [];
    const length = Math.min(columnsSize.length, columns.length);
    const effectiveScrollLeft = Math.max(0, scroll.left - rowNumberColumnWidth);

    let startColumnPosition = 0;
    let endColumnPosition = 0;

    for (let i = 0; i < length; i++) {
      const colSize = columnsSize[i];
      endColumnPosition = startColumnPosition + colSize;

      if (startColumnPosition >= effectiveScrollLeft || endColumnPosition >= effectiveScrollLeft) {
        columnsIndexToRender.push(i);
      }

      startColumnPosition = endColumnPosition;

      if (startColumnPosition > widthBodyContainer + effectiveScrollLeft) break;
    }

    return { columnsIndexToRender };
  }, [scroll.left, rowNumberColumnWidth, columnsSize, widthBodyContainer, columns]);

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

  const onResize = React.useCallback(
    (index: number, size: number) => {
      const minSizeAllowed = minColumnsSize[index] ?? 0;
      let allowedSize = size;

      if (size <= minSizeAllowed) {
        allowedSize = minSizeAllowed;
      } else if (allowedSize > maxColumnSize) {
        allowedSize = maxColumnSize;
      }

      setColumnsSize((prevState) => {
        const nextState = [...prevState];

        nextState[index] = allowedSize;

        return nextState;
      });
    },
    [maxColumnSize, minColumnsSize],
  );

  const onResizeAnalysisColumn = React.useCallback(
    (index: number, size: number) => {
      const minSizeAllowed = analysisMinColumnsSize[index] ?? 0;
      let allowedSize = size;

      if (size <= minSizeAllowed) {
        allowedSize = minSizeAllowed;
      } else if (allowedSize > maxColumnSize) {
        allowedSize = maxColumnSize;
      }

      setAnalysisColumnsSize((prevState) => {
        const nextState = [...prevState];

        nextState[index] = allowedSize;

        return nextState;
      });
    },
    [analysisMinColumnsSize, maxColumnSize],
  );

  const checkScrollEnd = React.useCallback(() => {
    const element = refScrollContainer.current;
    if (!element || !onScrollEnd) return;

    const hasVerticalScroll = element.scrollHeight > element.clientHeight;
    if (!hasVerticalScroll) return;

    const threshold = 8;
    const isEndVerticalScroll =
      Math.ceil(element.clientHeight + element.scrollTop) >= element.scrollHeight - threshold;

    if (isEndVerticalScroll) {
      onScrollEnd();
    }
  }, [onScrollEnd]);

  const captureDefaultScroll = React.useCallback(() => {
    const element = refScrollContainer.current;
    const nextScroll = element
      ? { left: element.scrollLeft, top: element.scrollTop }
      : defaultScrollRef.current;

    defaultScrollRef.current = nextScroll;
    setScroll(nextScroll);

    return nextScroll;
  }, [setScroll]);

  const restoreDefaultScroll = React.useCallback(() => {
    const element = refScrollContainer.current;
    if (!element) return;

    const nextScroll = defaultScrollRef.current;
    element.scrollLeft = nextScroll.left;
    element.scrollTop = nextScroll.top;
    setScroll(nextScroll);
  }, [setScroll]);

  const onScroll = React.useCallback(
    (event: React.UIEvent<HTMLDivElement, UIEvent>) => {
      const nextScroll = {
        left: event.currentTarget.scrollLeft,
        top: event.currentTarget.scrollTop,
      };

      defaultScrollRef.current = nextScroll;
      setScrollDebounced(nextScroll);

      if (nextScroll.top !== scroll.top) {
        checkScrollEnd();
      }
    },
    [checkScrollEnd, scroll.top, setScrollDebounced],
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

  const onSaveCell = React.useCallback(
    (
      indexRow: number,
      rowColumnKey: string,
      newValue: TableCellEditValue,
      keepEditing?: boolean,
      replicateSelectedCells = true,
    ) => {
      if (!keepEditing) {
        setCellEditingKey(null);
        setCellEditInitialValue(undefined);
        refScrollContainer.current?.focus();
      }

      const saveCell = (rowIndex: number, attribute: string) => {
        const row = serializedRowsRef.current[rowIndex];

        if (row?.__is_new_row) {
          onEditNewRow?.(row.__key_row, attribute, newValue);
          return;
        }

        onEditRow?.(row?.__row_index ?? rowIndex, attribute, newValue, row?.__key_row);
      };

      const columnIndex = columnsRef.current.findIndex(
        (column) => String(column.attribute) === rowColumnKey,
      );
      const selectedCells = analysisModeRef.current
        ? analysisSelectedCellsRef.current
        : selectedCellsRef.current;
      const editedCellKey = columnIndex === -1 ? null : cellKey(indexRow, columnIndex);
      const shouldReplicate =
        replicateSelectedCells &&
        selectedCells.size > 1 &&
        editedCellKey !== null &&
        selectedCells.has(editedCellKey);

      if (!shouldReplicate) {
        saveCell(indexRow, rowColumnKey);
        return;
      }

      selectedCells.forEach((key) => {
        const [rowIndex, colIndex] = key.split(':').map(Number);
        const row = serializedRowsRef.current[rowIndex];
        const column = columnsRef.current[colIndex];

        if (!row || !column?.editable) return;
        if (column.type === 'autocomplete') {
          if (Array.isArray(newValue) || !column.dataAutocomplete?.includes(String(newValue))) {
            return;
          }
        }
        if (row.__is_new_row ? !onEditNewRow : !onEditRow) return;

        saveCell(rowIndex, String(column.attribute));
      });
    },
    [onEditNewRow, onEditRow],
  );

  const onBlurCell = React.useCallback(() => {
    setCellEditingKey(null);
    setCellEditInitialValue(undefined);
    refScrollContainer.current?.focus();
  }, []);

  const handleDoubleClickCell = React.useCallback((rowColumnKey: string) => {
    const [, attribute] = rowColumnKey.split(':');
    const column = columnsRef.current.find((item) => String(item.attribute) === attribute);

    if (!column?.editable) return;

    setCellEditInitialValue(undefined);
    setCellEditingKey(rowColumnKey);
  }, []);

  const notifySelectedCell = React.useCallback(
    (rowIndex: number, colIndex: number) => {
      const row = serializedRowsRef.current[rowIndex];
      const column = columnsRef.current[colIndex];

      if (!row || !column) return;

      const editedRow = editedRows?.get(row.__key_row);
      const newRow = newRows?.get(row.__key_row);
      const editedValue = editedRow?.[column.attribute];
      const newValue = newRow?.[column.attribute];
      const hasNewValue = newValue !== undefined;
      const isEdited = editedValue !== undefined;
      const value = hasNewValue ? newValue : isEdited ? editedValue : row[column.attribute];

      onSelectCellData?.({
        row,
        column,
        value,
        rowIndex,
        colIndex,
      });
    },
    [editedRows, newRows, onSelectCellData],
  );

  const selectDefaultRange = React.useCallback(
    (anchor: TableCellPosition, target: TableCellPosition) => {
      const minRow = Math.min(anchor.rowIndex, target.rowIndex);
      const maxRow = Math.max(anchor.rowIndex, target.rowIndex);
      const minCol = Math.min(anchor.colIndex, target.colIndex);
      const maxCol = Math.max(anchor.colIndex, target.colIndex);

      setSelectedCells(() => {
        const next = new Set<string>();
        for (let rowIndex = minRow; rowIndex <= maxRow; rowIndex++)
          for (let colIndex = minCol; colIndex <= maxCol; colIndex++)
            next.add(cellKey(rowIndex, colIndex));
        return next;
      });
    },
    [],
  );

  const handleSelectCell = React.useCallback(
    (rowIndex: number, colIndex: number) => {
      if (ignoreNextClickRef.current) {
        ignoreNextClickRef.current = false;
        return;
      }

      refScrollContainer.current?.focus();
      notifySelectedCell(rowIndex, colIndex);

      if (!window.shiftPressed || !lastSelectedCellRef.current) {
        lastSelectedCellRef.current = { rowIndex, colIndex };
      }
      arrowCursorRef.current = { rowIndex, colIndex };

      if (window.ctrlPressed || window.metaPressed) {
        setSelectedCells((prev) => {
          const next = new Set(prev);
          const key = cellKey(rowIndex, colIndex);
          next.has(key) ? next.delete(key) : next.add(key);
          return next;
        });
      } else if (window.shiftPressed && lastSelectedCellRef.current) {
        const anchor = lastSelectedCellRef.current;
        selectDefaultRange(anchor, { rowIndex, colIndex });
      } else {
        setSelectedCells(new Set([cellKey(rowIndex, colIndex)]));
      }
    },
    [notifySelectedCell, selectDefaultRange],
  );

  const handleSelectColumn = React.useCallback(
    (colIndex: number) => {
      const rows = serializedRowsRef.current;
      if (!rows.length) return;

      lastSelectedCellRef.current = { rowIndex: 0, colIndex };
      arrowCursorRef.current = { rowIndex: 0, colIndex };
      notifySelectedCell(0, colIndex);

      setSelectedCells(() => {
        const next = new Set<string>();
        rows.forEach((_, rowIndex) => next.add(cellKey(rowIndex, colIndex)));
        return next;
      });
    },
    [notifySelectedCell],
  );

  const selectAnalysisRange = React.useCallback(
    (
      anchor: { rowIndex: number; colIndex: number },
      target: { rowIndex: number; colIndex: number },
    ) => {
      const rowsToAnalyze = analysisRowsRef.current;
      const anchorRowPosition = rowsToAnalyze.findIndex(
        (row) => row.__index_row === anchor.rowIndex,
      );
      const targetRowPosition = rowsToAnalyze.findIndex(
        (row) => row.__index_row === target.rowIndex,
      );

      if (anchorRowPosition === -1 || targetRowPosition === -1) return;

      const minField = Math.min(anchor.colIndex, target.colIndex);
      const maxField = Math.max(anchor.colIndex, target.colIndex);
      const minRowPosition = Math.min(anchorRowPosition, targetRowPosition);
      const maxRowPosition = Math.max(anchorRowPosition, targetRowPosition);

      setAnalysisSelectedCells(() => {
        const next = new Set<string>();
        for (let rowPosition = minRowPosition; rowPosition <= maxRowPosition; rowPosition++) {
          const rowIndex = rowsToAnalyze[rowPosition]?.__index_row;
          if (rowIndex === undefined) continue;
          for (let fieldIndex = minField; fieldIndex <= maxField; fieldIndex++) {
            next.add(cellKey(rowIndex, fieldIndex));
          }
        }
        return next;
      });
    },
    [],
  );

  const handleSelectAnalysisCell = React.useCallback(
    (rowIndex: number, colIndex: number) => {
      if (ignoreNextClickRef.current) {
        ignoreNextClickRef.current = false;
        return;
      }

      refScrollContainer.current?.focus();
      notifySelectedCell(rowIndex, colIndex);

      if (!window.shiftPressed || !lastAnalysisSelectedCellRef.current) {
        lastAnalysisSelectedCellRef.current = { rowIndex, colIndex };
      }
      analysisArrowCursorRef.current = { rowIndex, colIndex };

      if (window.ctrlPressed || window.metaPressed) {
        setAnalysisSelectedCells((prev) => {
          const next = new Set(prev);
          const key = cellKey(rowIndex, colIndex);
          next.has(key) ? next.delete(key) : next.add(key);
          return next;
        });
      } else if (window.shiftPressed && lastAnalysisSelectedCellRef.current) {
        selectAnalysisRange(lastAnalysisSelectedCellRef.current, { rowIndex, colIndex });
      } else {
        setAnalysisSelectedCells(new Set([cellKey(rowIndex, colIndex)]));
      }
    },
    [notifySelectedCell, selectAnalysisRange],
  );

  const handleStartCellDrag = React.useCallback(
    (
      rowIndex: number,
      colIndex: number,
      event: React.MouseEvent<HTMLElement, MouseEvent>,
    ) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (cellEditingKeyRef.current) return;

      event.preventDefault();

      const anchor = { rowIndex, colIndex };
      dragSelectionRef.current = { mode: 'default', anchor, hasMoved: false };
      lastSelectedCellRef.current = anchor;
      arrowCursorRef.current = anchor;
      refScrollContainer.current?.focus();
      notifySelectedCell(rowIndex, colIndex);
      setSelectedCells(new Set([cellKey(rowIndex, colIndex)]));
    },
    [notifySelectedCell],
  );

  const handleMoveCellDrag = React.useCallback(
    (rowIndex: number, colIndex: number) => {
      const dragSelection = dragSelectionRef.current;
      if (!dragSelection || dragSelection.mode !== 'default') return;

      const target = { rowIndex, colIndex };
      if (
        target.rowIndex === dragSelection.anchor.rowIndex &&
        target.colIndex === dragSelection.anchor.colIndex
      ) {
        return;
      }

      dragSelection.hasMoved = true;
      arrowCursorRef.current = target;
      selectDefaultRange(dragSelection.anchor, target);
      notifySelectedCell(rowIndex, colIndex);
    },
    [notifySelectedCell, selectDefaultRange],
  );

  const handleStartAnalysisCellDrag = React.useCallback(
    (
      rowIndex: number,
      colIndex: number,
      event: React.MouseEvent<HTMLElement, MouseEvent>,
    ) => {
      if (event.button !== 0 || event.ctrlKey || event.metaKey || event.shiftKey) return;
      if (cellEditingKeyRef.current) return;

      event.preventDefault();

      const anchor = { rowIndex, colIndex };
      dragSelectionRef.current = { mode: 'analysis', anchor, hasMoved: false };
      lastAnalysisSelectedCellRef.current = anchor;
      analysisArrowCursorRef.current = anchor;
      refScrollContainer.current?.focus();
      notifySelectedCell(rowIndex, colIndex);
      setAnalysisSelectedCells(new Set([cellKey(rowIndex, colIndex)]));
    },
    [notifySelectedCell],
  );

  const handleMoveAnalysisCellDrag = React.useCallback(
    (rowIndex: number, colIndex: number) => {
      const dragSelection = dragSelectionRef.current;
      if (!dragSelection || dragSelection.mode !== 'analysis') return;

      const target = { rowIndex, colIndex };
      if (
        target.rowIndex === dragSelection.anchor.rowIndex &&
        target.colIndex === dragSelection.anchor.colIndex
      ) {
        return;
      }

      dragSelection.hasMoved = true;
      analysisArrowCursorRef.current = target;
      selectAnalysisRange(dragSelection.anchor, target);
      notifySelectedCell(rowIndex, colIndex);
    },
    [notifySelectedCell, selectAnalysisRange],
  );

  const handleEndCellDrag = React.useCallback((event?: MouseEvent) => {
    const targetElement = event?.target instanceof HTMLElement ? event.target : null;
    const endedOverCell = !!targetElement?.closest(
      `.${styles.table_column}, .${styles.analysis_value}`,
    );

    if (dragSelectionRef.current?.hasMoved && endedOverCell) {
      ignoreNextClickRef.current = true;
    }

    dragSelectionRef.current = null;
  }, []);

  const handleContextMenu = (event: React.MouseEvent<HTMLDivElement, MouseEvent>) => {
    if (!onContextMenu) return;

    const cells = analysisMode ? analysisSelectedCellsRef.current : selectedCellsRef.current;
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

    const selectedCellRows = [...rowMap.entries()]
      .sort((a, b) => a[0] - b[0])
      .map(([rowIndex, colIndices]) => {
        const row = serializedRowsRef.current[rowIndex];
        const sortedColIndices = [...colIndices].sort((a, b) => a - b);

        return Object.fromEntries(
          sortedColIndices
            .map((colIndex) => {
              const col = columnsRef.current[colIndex];
              if (!col) return null;

              return [col.attribute, row?.[col.attribute] ?? null];
            })
            .filter((entry): entry is [string, any] => !!entry),
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
      rows: rowObjects,
      selectedCellRows,
    });
  };

  const resetAnalysisMode = React.useCallback(() => {
    setAnalysisMode(false);
    setAnalysisRows([]);
    setAnalysisColumnsSize([]);
    setAnalysisMinColumnsSize([]);
    setAnalysisSelectedCells(new Set());
    lastAnalysisSelectedCellRef.current = null;
    analysisArrowCursorRef.current = null;
  }, []);

  const cssVars = toCssProperties({
    ...theme,
    height: `${serializedRows.length * rowHeight}px`,
    width: `${tableDetails.width + rowNumberColumnWidth}px`,
    rowHeight: `${rowHeight}px`,
    rowNumberColumnWidth: `${rowNumberColumnWidth}px`,
    totalRows: serializedRows.length,
    columnsSize: tableDetails.columnsSizeStr,
    analysisRows: analysisRows.length,
  });

  React.useEffect(() => {
    window.addEventListener('mouseup', handleEndCellDrag);

    return () => {
      window.removeEventListener('mouseup', handleEndCellDrag);
    };
  }, [handleEndCellDrag]);

  React.useEffect(() => {
    const cb = (ev: KeyboardEvent) => {
      if (ev.key === 'Tab' && !cellEditingKeyRef.current) {
        const hasSelectedRows = selectedRowsRef.current.size > 0;
        if (analysisMode) {
          ev.preventDefault();
          setAnalysisMode(false);
        } else if (hasSelectedRows) {
          ev.preventDefault();
          const rowsToAnalyze = [...selectedRowsRef.current.values()].sort(
            (a, b) => a.__index_row - b.__index_row,
          );
          const firstColumnMinSize = Math.ceil(
            Math.max(
              0,
              ...columnsRef.current.map((column) => calculateTextHtmlWidth(column.label)),
            ) + 40,
          );
          const rowColumnsMinSize = rowsToAnalyze.map((row) =>
            Math.ceil(calculateTextHtmlWidth(`Linha #${Number(row.__index_row) + 1}`) + 40),
          );
          const minSizes = [firstColumnMinSize, ...rowColumnsMinSize];
          const sizes = minSizes.map((size) => {
            const defaultSize = size > defaultColumnSize ? size : defaultColumnSize;
            return defaultSize > maxColumnSize ? maxColumnSize : defaultSize;
          });

          setAnalysisRows(rowsToAnalyze);
          setAnalysisMinColumnsSize(minSizes);
          setAnalysisColumnsSize(sizes);
          setAnalysisSelectedCells(new Set(selectedCellsRef.current));
          lastAnalysisSelectedCellRef.current = lastSelectedCellRef.current;
          analysisArrowCursorRef.current = lastSelectedCellRef.current;
          captureDefaultScroll();
          setAnalysisMode(true);
        }
      }

      if (ev.key === 'Enter' && !cellEditingKeyRef.current) {
        const anchor = analysisModeEnterRef.current
          ? lastAnalysisSelectedCellRef.current
          : lastSelectedCellRef.current;
        if (!anchor) return;

        ev.preventDefault();

        const row = analysisModeEnterRef.current
          ? analysisRowsRef.current.find((item) => item.__index_row === anchor.rowIndex)
          : serializedRowsRef.current[anchor.rowIndex];
        const column = columnsRef.current[anchor.colIndex];

        if (!row || !column?.editable) return;

        setCellEditInitialValue(undefined);
        setCellEditingKey(`${row.__key_row}:${String(column.attribute)}`);
      }

      const isTypingEditKey =
        ev.key.length === 1 &&
        !ev.ctrlKey &&
        !ev.metaKey &&
        !ev.altKey &&
        !ev.isComposing &&
        !cellEditingKeyRef.current;

      if (isTypingEditKey) {
        const anchor = analysisModeEnterRef.current
          ? lastAnalysisSelectedCellRef.current
          : lastSelectedCellRef.current;
        if (!anchor) return;

        const row = analysisModeEnterRef.current
          ? analysisRowsRef.current.find((item) => item.__index_row === anchor.rowIndex)
          : serializedRowsRef.current[anchor.rowIndex];
        const column = columnsRef.current[anchor.colIndex];

        if (!row || !column?.editable) return;

        ev.preventDefault();
        setCellEditInitialValue(ev.key);
        setCellEditingKey(`${row.__key_row}:${String(column.attribute)}`);
      }

      const isCopy = (window.ctrlPressed || window.metaPressed) && ev.key?.toLowerCase() === 'c';

      if (isCopy) {
        const cells = analysisMode ? analysisSelectedCellsRef.current : selectedCellsRef.current;
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
    };

    refScrollContainer.current?.addEventListener?.('keydown', cb);

    return () => {
      refScrollContainer.current?.removeEventListener?.('keydown', cb);
    };
  }, [analysisMode, captureDefaultScroll]);

  React.useEffect(() => {
    const cb = (ev: KeyboardEvent) => {
      const isArrow = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(ev.key);

      if (analysisModeRef.current) {
        if (cellEditingKeyRef.current || !isArrow) return;

        ev.preventDefault();

        const rowsToAnalyze = analysisRowsRef.current;
        const totalRows = rowsToAnalyze.length;
        const totalFields = columnsRef.current.length;
        if (!totalRows || !totalFields) return;

        const anchor = lastAnalysisSelectedCellRef.current;
        const fallbackCell = {
          rowIndex: rowsToAnalyze[0].__index_row,
          colIndex: 0,
        };
        const cursor = analysisArrowCursorRef.current ?? anchor ?? fallbackCell;
        let fieldIndex = cursor.colIndex;
        let rowPosition = rowsToAnalyze.findIndex((row) => row.__index_row === cursor.rowIndex);
        if (rowPosition === -1) rowPosition = 0;

        if (ev.key === 'ArrowUp') fieldIndex = Math.max(0, fieldIndex - 1);
        else if (ev.key === 'ArrowDown') fieldIndex = Math.min(totalFields - 1, fieldIndex + 1);
        else if (ev.key === 'ArrowLeft') rowPosition = Math.max(0, rowPosition - 1);
        else if (ev.key === 'ArrowRight') rowPosition = Math.min(totalRows - 1, rowPosition + 1);

        const target = {
          rowIndex: rowsToAnalyze[rowPosition].__index_row,
          colIndex: fieldIndex,
        };

        analysisArrowCursorRef.current = target;

        if (ev.shiftKey && anchor) {
          selectAnalysisRange(anchor, target);
        } else {
          lastAnalysisSelectedCellRef.current = target;
          setAnalysisSelectedCells(new Set([cellKey(target.rowIndex, target.colIndex)]));
        }

        notifySelectedCell(target.rowIndex, target.colIndex);

        const container = refScrollContainer.current?.querySelector(
          `.${styles.analysis_container}`,
        ) as HTMLElement;
        if (!container) return;

        const cellTop = (fieldIndex + 1) * rowHeight;
        const cellBottom = cellTop + rowHeight;
        if (cellTop < container.scrollTop) {
          container.scrollTop = cellTop;
        } else if (cellBottom > container.scrollTop + container.clientHeight) {
          container.scrollTop = cellBottom - container.clientHeight;
        }

        const sizes = analysisColumnsSizeRef.current;
        let cellLeft = sizes[0] || 0;
        for (let i = 1; i <= rowPosition; i++) cellLeft += sizes[i] || 0;
        const cellWidth = sizes[rowPosition + 1] || 0;
        const cellRight = cellLeft + cellWidth;
        if (cellLeft < container.scrollLeft) {
          container.scrollLeft = cellLeft;
        } else if (cellRight > container.scrollLeft + container.clientWidth) {
          container.scrollLeft = cellRight - container.clientWidth;
        }

        return;
      }

      const anchor = lastSelectedCellRef.current;
      if (!anchor || cellEditingKeyRef.current) return;

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
        selectDefaultRange(anchor, { rowIndex, colIndex });
      } else {
        lastSelectedCellRef.current = { rowIndex, colIndex };
        setSelectedCells(new Set([cellKey(rowIndex, colIndex)]));
      }

      notifySelectedCell(rowIndex, colIndex);

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
      let colStart = rowNumberColumnWidth;
      for (let i = 0; i < colIndex; i++) colStart += sizes[i] || 0;
      const colEnd = colStart + (sizes[colIndex] || 0);
      if (colStart < container.scrollLeft) {
        container.scrollLeft = Math.max(0, colStart - rowNumberColumnWidth);
      } else if (colEnd > container.scrollLeft + container.clientWidth) {
        container.scrollLeft = colEnd - container.clientWidth;
      }
    };

    refScrollContainer.current?.addEventListener?.('keydown', cb);
    return () => {
      refScrollContainer.current?.removeEventListener?.('keydown', cb);
    };
  }, [notifySelectedCell, rowNumberColumnWidth, selectAnalysisRange, selectDefaultRange]);

  React.useEffect(() => {
    const defaultColumnsSize = columns.map((column) => {
      return Math.ceil(calculateTextHtmlWidth(column.label) + 40);
    });

    setColumnsSize((prevState) => {
      if (prevState.length === columns.length) return prevState;

      return defaultColumnsSize.map((size) =>
        size > defaultColumnSize ? size : defaultColumnSize,
      );
    });

    setMinColumnsSize((prevState) => {
      const isSameState =
        prevState.length === defaultColumnsSize.length &&
        prevState.every((size, index) => size === defaultColumnsSize[index]);

      return isSameState ? prevState : defaultColumnsSize;
    });
  }, [columns, defaultColumnSize]);

  React.useEffect(() => {
    const container = refScrollContainer.current;

    const handlePaste = (event: ClipboardEvent) => {
      if (cellEditingKeyRef.current) return;

      const cells = analysisModeRef.current
        ? analysisSelectedCellsRef.current
        : selectedCellsRef.current;

      if (!cells.size) return;

      const grid = parseClipboardGrid(event.clipboardData?.getData('text/plain') ?? '');
      const isMatrix = grid.length > 1 || grid[0].length > 1;
      const coordinates = [...cells].map((key) => key.split(':').map(Number));
      const firstRow = Math.min(...coordinates.map(([row]) => row));
      const firstColumn = Math.min(...coordinates.map(([, column]) => column));

      const edits = coordinates.flatMap(([rowIndex, colIndex]) => {
        const row = serializedRowsRef.current[rowIndex];
        const column = columnsRef.current[colIndex];
        const value = isMatrix ? grid[rowIndex - firstRow]?.[colIndex - firstColumn] : grid[0][0];

        if (!row || !column?.editable || value === undefined) return [];
        if (column.type === 'autocomplete' && !column.dataAutocomplete?.includes(value)) return [];
        if (row.__is_new_row ? !onEditNewRow : !onEditRow) return [];

        return [{ rowIndex, attribute: String(column.attribute), value }];
      });

      if (!edits.length) return;

      event.preventDefault();
      edits.forEach(({ rowIndex, attribute, value }) => {
        onSaveCell(rowIndex, attribute, value, true, false);
      });
    };

    container?.addEventListener('paste', handlePaste);

    return () => {
      container?.removeEventListener('paste', handlePaste);
    };
  }, [onEditNewRow, onEditRow, onSaveCell]);

  React.useEffect(() => {
    onSelectRow?.([...selectedRows.values()]);
  }, [selectedRows]);

  React.useLayoutEffect(() => {
    if (analysisMode) return;

    restoreDefaultScroll();
  }, [analysisMode, restoreDefaultScroll]);

  React.useEffect(() => {
    resetAnalysisMode();
  }, [columnsSignature, resetAnalysisMode]);

  React.useEffect(() => {
    if (!analysisModeRef.current || !analysisRowsRef.current.length) return;

    const nextAnalysisRows = analysisRowsRef.current.flatMap((analysisRow) => {
      const nextRow = serializedRowsRef.current.find(
        (row) => row.__key_row === analysisRow.__key_row,
      );

      return nextRow ? [nextRow] : [];
    });

    if (nextAnalysisRows.length !== analysisRowsRef.current.length) {
      resetAnalysisMode();
      return;
    }

    setAnalysisRows(nextAnalysisRows);
  }, [resetAnalysisMode, serializedRows]);

  return (
    <div
      ref={refScrollContainer}
      onScroll={analysisMode ? undefined : onScroll}
      className={styles.table_outside_container}
      onContextMenu={handleContextMenu}
      style={cssVars}
      tabIndex={0}
    >
      {!!loading && <MultiplesBarLoading zIndex={7} />}

      {analysisMode ? (
        <TableAnalysisView
          columns={columns}
          rows={analysisRows}
          rowHeight={rowHeight}
          columnsSize={analysisColumnsSize}
          minColumnsSize={analysisMinColumnsSize}
          editedRows={editedRows}
          newRows={newRows}
          cellEditingKey={cellEditingKey}
          cellEditInitialValue={cellEditInitialValue}
          selectedCells={analysisSelectedCells}
          onResizeColumn={onResizeAnalysisColumn}
          onDoubleClick={handleDoubleClickCell}
          onEditCell={onSaveCell}
          onBlurCell={onBlurCell}
          onSelectCell={handleSelectAnalysisCell}
          onStartCellDrag={handleStartAnalysisCellDrag}
          onMoveCellDrag={handleMoveAnalysisCellDrag}
          onCellLinkClick={onCellLinkClick}
          onCellLinkPreviewClick={onCellLinkPreviewClick}
          cellLinkClickMode={cellLinkClickMode}
        />
      ) : (
        <TableDefaultView
          columns={columns}
          rows={serializedRows}
          rowHeight={rowHeight}
          columnsSize={columnsSize}
          minColumnsSize={minColumnsSize}
          editedRows={editedRows}
          newRows={newRows}
          cellEditingKey={cellEditingKey}
          cellEditInitialValue={cellEditInitialValue}
          selectedCells={selectedCells}
          selectedRows={selectedRows}
          columnsIndexToRender={columnsDetails.columnsIndexToRender}
          firstRowIndex={rowsDetails.first}
          lastRowIndex={rowsDetails.last}
          getSortLabel={getSortLabel}
          onResizeColumn={onResize}
          onSort={onSort}
          onDoubleClick={handleDoubleClickCell}
          onEditCell={onSaveCell}
          onBlurCell={onBlurCell}
          onSelectCell={handleSelectCell}
          onStartCellDrag={handleStartCellDrag}
          onMoveCellDrag={handleMoveCellDrag}
          onSelectColumn={handleSelectColumn}
          onCellLinkClick={onCellLinkClick}
          onCellLinkPreviewClick={onCellLinkPreviewClick}
          cellLinkClickMode={cellLinkClickMode}
        />
      )}
    </div>
  );
}

export default Table;
