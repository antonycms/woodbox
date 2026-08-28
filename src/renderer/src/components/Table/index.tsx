import React from 'react';
import useResize from '@renderer/hooks/useResize';
import useDebounce from '@renderer/hooks/useDebounce';
import { calculateTextHtmlWidth, copyToClipboard } from '@renderer/utils/methods';
import { MultiplesBarLoading } from '@renderer/components/Loaders';
import styles from './styles.module.css';
import TableAnalysisView from './components/TableAnalysisView';
import TableDefaultView from './components/TableDefaultView';
import TableSearchBar from './components/TableSearchBar';
import { useThemeContext } from '@renderer/contexts/Theme';
import { isPrimaryShortcutPressed } from '@renderer/utils/keyboard';
import type { IColumn, ISortDirection, ITableSort } from './dtos';
import { useTableLayout } from './hooks/useTableLayout';
import { useTableColumnResize } from './hooks/useTableColumnResize';
import { useAnalysisColumnsLayout } from './hooks/useAnalysisColumnsLayout';
import { serializeTableCopyValue, serializeTableValue } from './utils';

type TableCellEditValue = string | number | (string | number)[];
type TableScrollState = { left: number; top: number };
type TableCellPosition = { rowIndex: number; colIndex: number };
type TableSearchOverlayPosition = { top: number; right: number };
type TableSearchOptions = { matchCase: boolean; wholeWord: boolean };
type TableSearchOccurrence = TableCellPosition & { key: string; canReplace: boolean };
type TableSearchState = TableSearchOptions & {
  open: boolean;
  replaceOpen: boolean;
  query: string;
  replace: string;
  activeIndex: number;
};
type TableDragSelectionState = {
  mode: 'default' | 'analysis';
  anchor: TableCellPosition;
  hasMoved: boolean;
};

const TABLE_SEARCH_CLOSE_ANIMATION_MS = 120;

export interface ITableContextMenuCellData<Row = any> {
  row: Row;
  column: IColumn<Row>;
  rowIndex: number;
  colIndex: number;
}

export interface ITableContextMenuData<Row = any> {
  cellsText: string;
  rowsText: string;
  rowsJson: string;
  rows: Record<string, any>[];
  selectedCellRows: Record<string, any>[];
  selectedCells: ITableContextMenuCellData<Row>[];
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
    data: ITableContextMenuData<Row>,
  ): void;
  onScrollEnd?(): void;
  onEditRow?(indexRow: number, attribute: string, value: any, rowKey?: React.Key): void;
  onEditNewRow?(rowKey: React.Key, attribute: string, value: any): void;
  editedRows?: Map<React.Key, any>;
  newRows?: Map<React.Key, any>;
  newRowsPosition?: 'start' | 'end';
  removedRows?: Set<React.Key>;
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
  initialAnalysisMode?: boolean;
}

const rowKeyExtractorDefault: ITableProps['rowKeyExtractor'] = (_, index) => index;

const cellKey = (rowIndex: number, colIndex: number) => `${rowIndex}:${colIndex}`;

const parseClipboardGrid = (text: string) => {
  const normalizedText = text.replace(/\r\n?/g, '\n').replace(/\n$/, '');

  return normalizedText.split('\n').map((line) => line.split('\t'));
};

const isSearchWordChar = (char?: string) => {
  if (!char) return false;

  return /[\p{L}\p{N}_]/u.test(char);
};

const findSearchIndex = (
  value: string,
  query: string,
  { matchCase, wholeWord }: TableSearchOptions,
  startIndex = 0,
) => {
  if (!query) return -1;

  const searchableValue = matchCase ? value : value.toLocaleLowerCase();
  const searchableQuery = matchCase ? query : query.toLocaleLowerCase();
  let index = searchableValue.indexOf(searchableQuery, startIndex);

  while (index !== -1) {
    const before = value[index - 1];
    const after = value[index + query.length];
    const isWholeWord = !isSearchWordChar(before) && !isSearchWordChar(after);

    if (!wholeWord || isWholeWord) return index;

    index = searchableValue.indexOf(searchableQuery, index + query.length);
  }

  return -1;
};

const replaceSearchValue = (
  value: string,
  query: string,
  replace: string,
  options: TableSearchOptions,
  replaceAll: boolean,
) => {
  let nextValue = '';
  let startIndex = 0;

  while (startIndex <= value.length) {
    const foundIndex = findSearchIndex(value, query, options, startIndex);

    if (foundIndex === -1) {
      nextValue += value.slice(startIndex);
      break;
    }

    nextValue += value.slice(startIndex, foundIndex) + replace;
    startIndex = foundIndex + query.length;

    if (!replaceAll) {
      nextValue += value.slice(startIndex);
      break;
    }
  }

  return nextValue;
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
    newRowsPosition = 'start',
    removedRows,
    onEditRow,
    onEditNewRow,
    sort,
    onSort,
    onSelectRow,
    onSelectCellData,
    onCellLinkClick,
    onCellLinkPreviewClick,
    cellLinkClickMode = 'ctrl',
    initialAnalysisMode,
  } = props;

  const {
    activeTheme: { table: theme },
  } = useThemeContext();
  const refScrollContainer = React.useRef<HTMLDivElement>(null);
  const refAnalysisScrollContainer = React.useRef<HTMLDivElement>(null);
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
  const [searchClosing, setSearchClosing] = React.useState(false);
  const [searchState, setSearchState] = React.useState<TableSearchState>({
    open: false,
    replaceOpen: false,
    query: '',
    replace: '',
    matchCase: false,
    wholeWord: false,
    activeIndex: 0,
  });
  const [searchOverlayPosition, setSearchOverlayPosition] =
    React.useState<TableSearchOverlayPosition>({
      top: 8,
      right: 8,
    });
  const lastSelectedCellRef = React.useRef<{ rowIndex: number; colIndex: number } | null>(null);
  const lastAnalysisSelectedCellRef = React.useRef<{ rowIndex: number; colIndex: number } | null>(
    null,
  );
  const dragSelectionRef = React.useRef<TableDragSelectionState | null>(null);
  const ignoreNextClickRef = React.useRef(false);
  const searchCloseTimeoutRef = React.useRef<number | undefined>(undefined);
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
    const newRowsStartIndex = newRowsPosition === 'end' ? rows.length : 0;
    const rowsStartIndex = newRowsPosition === 'end' ? 0 : newRowsLength;

    const serializedNewRows = [...(newRows?.entries() ?? [])].map(([keyRow, row], index) => ({
      ...row,
      __index_row: newRowsStartIndex + index,
      __row_index: index,
      __key_row: keyRow,
      __is_new_row: true,
    }));

    const serializedRows = rows.map((row, index) => {
      const keyRow = rowKeyExtractor(row, index);
      const isRemoved = removedRows?.has(keyRow);

      return {
        ...row,
        __index_row: rowsStartIndex + index,
        __row_index: index,
        __key_row: keyRow,
        __is_removed: isRemoved,
      };
    });

    return newRowsPosition === 'end'
      ? [...serializedRows, ...serializedNewRows]
      : [...serializedNewRows, ...serializedRows];
  }, [rows, newRows, newRowsPosition, removedRows, rowKeyExtractor]);

  const serializedRowsRef = React.useRef(serializedRows);
  serializedRowsRef.current = serializedRows;

  const selectedCellsRef = React.useRef(selectedCells);
  selectedCellsRef.current = selectedCells;
  const analysisSelectedCellsRef = React.useRef(analysisSelectedCells);
  analysisSelectedCellsRef.current = analysisSelectedCells;
  const analysisRowsRef = React.useRef(analysisRows);
  analysisRowsRef.current = analysisRows;
  const analysisColumnsSizeRef = React.useRef(analysisColumnsSize);
  const analysisModeEnterRef = React.useRef(analysisMode);
  analysisModeEnterRef.current = analysisMode;

  const {
    rowHeight,
    maxColumnSize,
    defaultColumnSize,
    rowNumberColumnWidth,
    columnsDetails,
    rowsDetails,
    tableDetails,
    cssVars,
  } = useTableLayout({
    theme,
    columnsLength: columns.length,
    columnsSize,
    scroll,
    widthBodyContainer,
    heightBodyContainer,
    serializedRowsLength: serializedRows.length,
    analysisRowsLength: analysisRows.length,
  });
  const containerStyle = React.useMemo(
    () =>
      ({
        ...cssVars,
        '--tableSearchTop': `${searchOverlayPosition.top}px`,
        '--tableSearchRight': `${searchOverlayPosition.right}px`,
        '--backgroundColorRowNew': theme.backgroundColorRowNew,
        '--backgroundColorRowRemoved': theme.backgroundColorRowRemoved,
      }) as React.CSSProperties,
    [
      theme.backgroundColorRowNew,
      theme.backgroundColorRowRemoved,
      cssVars,
      searchOverlayPosition.right,
      searchOverlayPosition.top,
    ],
  );

  const {
    visibleColumnsSize: visibleAnalysisColumnsSize,
    visibleMinColumnsSize: visibleAnalysisMinColumnsSize,
  } = useAnalysisColumnsLayout({
    columnsSize: analysisColumnsSize,
    minColumnsSize: analysisMinColumnsSize,
    widthBodyContainer,
  });

  analysisColumnsSizeRef.current = visibleAnalysisColumnsSize;

  const { onResize, onResizeAnalysisColumn } = useTableColumnResize({
    maxColumnSize,
    minColumnsSize,
    analysisMinColumnsSize: visibleAnalysisMinColumnsSize,
    setColumnsSize,
    setAnalysisColumnsSize,
  });

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

  const getResolvedCellValue = React.useCallback(
    (row: any, column?: IColumn<Row>) => {
      if (!row || !column) return undefined;

      const editedRow = editedRows?.get(row.__key_row);
      const newRow = newRows?.get(row.__key_row);
      const editedValue = editedRow?.[column.attribute];
      const newValue = newRow?.[column.attribute];
      const hasNewValue = newValue !== undefined;
      const isEdited = editedValue !== undefined;

      return hasNewValue ? newValue : isEdited ? editedValue : row[column.attribute];
    },
    [editedRows, newRows],
  );

  const searchOccurrences = React.useMemo<TableSearchOccurrence[]>(() => {
    const query = searchState.query;
    if (!query) return [];

    const searchableRows = analysisMode ? analysisRows : serializedRows;
    const options = {
      matchCase: searchState.matchCase,
      wholeWord: searchState.wholeWord,
    };
    const occurrences: TableSearchOccurrence[] = [];

    searchableRows.forEach((row: any) => {
      columns.forEach((column, colIndex) => {
        const value = getResolvedCellValue(row, column);
        const serializedValue = serializeTableValue(value, column.type, { nullAsEmpty: true });
        const canReplace =
          !!column.editable &&
          column.type !== 'autocomplete' &&
          column.type !== 'autocomplete-multi' &&
          !row.__is_removed && (row.__is_new_row ? !!onEditNewRow : !!onEditRow);

        if (findSearchIndex(serializedValue, query, options) !== -1) {
          occurrences.push({
            rowIndex: row.__index_row,
            colIndex,
            key: cellKey(row.__index_row, colIndex),
            canReplace,
          });
        }
      });
    });

    return occurrences;
  }, [
    analysisMode,
    analysisRows,
    columns,
    getResolvedCellValue,
    onEditNewRow,
    onEditRow,
    searchState.matchCase,
    searchState.query,
    searchState.wholeWord,
    serializedRows,
  ]);
  const activeSearchIndex =
    searchOccurrences.length && searchState.activeIndex < searchOccurrences.length
      ? searchState.activeIndex
      : 0;
  const activeSearchOccurrence = searchOccurrences[activeSearchIndex];
  const activeSearchCellKey = searchState.open ? activeSearchOccurrence?.key : undefined;
  const canReplaceCurrent = !!activeSearchOccurrence?.canReplace;
  const canReplaceAll = searchOccurrences.some((occurrence) => occurrence.canReplace);
  const searchMatchKeys = React.useMemo(() => {
    if (!searchState.open) return new Set<string>();

    return new Set(searchOccurrences.map((occurrence) => occurrence.key));
  }, [searchOccurrences, searchState.open]);
  const initialAnalysisModeAppliedRef = React.useRef(false);

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

  const scrollDefaultCellIntoView = React.useCallback(
    (rowIndex: number, colIndex: number) => {
      const container = refScrollContainer.current;
      if (!container) return;

      const cellTop = (rowIndex + 1) * rowHeight;
      const cellBottom = cellTop + rowHeight;
      const visibleTop = container.scrollTop + rowHeight;
      const visibleBottom = container.scrollTop + container.clientHeight;
      let top = container.scrollTop;

      if (cellTop < visibleTop) {
        top = Math.max(0, cellTop - rowHeight);
      } else if (cellBottom > visibleBottom) {
        top = cellBottom - container.clientHeight;
      }

      const sizes = columnsSizeRef.current;
      let cellLeft = rowNumberColumnWidth;
      for (let i = 0; i < colIndex; i++) cellLeft += sizes[i] || 0;

      const cellRight = cellLeft + (sizes[colIndex] || 0);
      const visibleLeft = container.scrollLeft + rowNumberColumnWidth;
      const visibleRight = container.scrollLeft + container.clientWidth;
      let left = container.scrollLeft;

      if (cellLeft < visibleLeft) {
        left = Math.max(0, cellLeft - rowNumberColumnWidth);
      } else if (cellRight > visibleRight) {
        left = cellRight - container.clientWidth;
      }

      const nextScroll = { left, top };
      container.scrollLeft = nextScroll.left;
      container.scrollTop = nextScroll.top;
      defaultScrollRef.current = nextScroll;
      setScroll(nextScroll);
    },
    [rowHeight, rowNumberColumnWidth],
  );

  const scrollAnalysisCellIntoView = React.useCallback(
    (rowIndex: number, colIndex: number) => {
      const container = refAnalysisScrollContainer.current;
      if (!container) return;

      const cellTop = (colIndex + 1) * rowHeight;
      const cellBottom = cellTop + rowHeight;
      const visibleTop = container.scrollTop + rowHeight;
      const visibleBottom = container.scrollTop + container.clientHeight - rowHeight;
      let top = container.scrollTop;

      if (cellTop < visibleTop) {
        top = Math.max(0, cellTop - rowHeight);
      } else if (cellBottom > visibleBottom) {
        top = cellBottom - container.clientHeight + rowHeight;
      }

      const rowPosition = analysisRowsRef.current.findIndex((row) => row.__index_row === rowIndex);
      if (rowPosition === -1) return;

      const sizes = analysisColumnsSizeRef.current;
      let cellLeft = sizes[0] || 0;
      for (let i = 1; i <= rowPosition; i++) cellLeft += sizes[i] || 0;

      const cellRight = cellLeft + (sizes[rowPosition + 1] || 0);
      let left = container.scrollLeft;

      if (cellLeft < container.scrollLeft + (sizes[0] || 0)) {
        left = Math.max(0, cellLeft - (sizes[0] || 0));
      } else if (cellRight > container.scrollLeft + container.clientWidth) {
        left = cellRight - container.clientWidth;
      }

      container.scrollLeft = left;
      container.scrollTop = top;
    },
    [rowHeight],
  );

  const scrollCellIntoView = React.useCallback(
    (rowIndex: number, colIndex: number) => {
      if (analysisModeRef.current) {
        scrollAnalysisCellIntoView(rowIndex, colIndex);
        return;
      }

      scrollDefaultCellIntoView(rowIndex, colIndex);
    },
    [scrollAnalysisCellIntoView, scrollDefaultCellIntoView],
  );

  const updateSearchOverlayPosition = React.useCallback(() => {
    const container = refScrollContainer.current;
    const rect = container?.getBoundingClientRect();
    if (!rect) return;

    setSearchOverlayPosition({
      top: rect.top + 8,
      right: window.innerWidth - rect.right + 8,
    });
  }, []);

  const handleOpenTableSearch = React.useCallback(() => {
    if (searchCloseTimeoutRef.current) {
      window.clearTimeout(searchCloseTimeoutRef.current);
      searchCloseTimeoutRef.current = undefined;
    }

    updateSearchOverlayPosition();
    setSearchClosing(false);
    setSearchState((prevState) => ({ ...prevState, open: true }));

    window.requestAnimationFrame(() => {
      const input = refScrollContainer.current?.querySelector(
        `.${styles.table_search_input}`,
      ) as HTMLInputElement | null;

      input?.focus();
      input?.select();
    });
  }, [updateSearchOverlayPosition]);

  const handleCloseTableSearch = React.useCallback(() => {
    if (searchCloseTimeoutRef.current) {
      window.clearTimeout(searchCloseTimeoutRef.current);
    }

    setSearchClosing(true);
    refScrollContainer.current?.focus();

    searchCloseTimeoutRef.current = window.setTimeout(() => {
      setSearchState({
        open: false,
        replaceOpen: false,
        query: '',
        replace: '',
        matchCase: false,
        wholeWord: false,
        activeIndex: 0,
      });
      setSearchClosing(false);
      searchCloseTimeoutRef.current = undefined;
    }, TABLE_SEARCH_CLOSE_ANIMATION_MS);
  }, []);

  const handleSearchQueryChange = React.useCallback((query: string) => {
    setSearchState((prevState) => ({ ...prevState, query, activeIndex: 0 }));
  }, []);

  const handleReplaceChange = React.useCallback((replace: string) => {
    setSearchState((prevState) => ({ ...prevState, replace }));
  }, []);

  const handleReplaceOpenChange = React.useCallback((replaceOpen: boolean) => {
    setSearchState((prevState) => ({ ...prevState, replaceOpen }));
  }, []);

  const handleToggleMatchCase = React.useCallback(() => {
    setSearchState((prevState) => ({
      ...prevState,
      matchCase: !prevState.matchCase,
      activeIndex: 0,
    }));
  }, []);

  const handleToggleWholeWord = React.useCallback(() => {
    setSearchState((prevState) => ({
      ...prevState,
      wholeWord: !prevState.wholeWord,
      activeIndex: 0,
    }));
  }, []);

  const handleSearchMove = React.useCallback(
    (step: number) => {
      if (!searchOccurrences.length) return;

      setSearchState((prevState) => ({
        ...prevState,
        activeIndex:
          (prevState.activeIndex + step + searchOccurrences.length) % searchOccurrences.length,
      }));
    },
    [searchOccurrences.length],
  );

  const handleSearchNext = React.useCallback(() => {
    handleSearchMove(1);
  }, [handleSearchMove]);

  const handleSearchPrevious = React.useCallback(() => {
    handleSearchMove(-1);
  }, [handleSearchMove]);

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

        if (!row || row.__is_removed) return;

        if (row.__is_new_row) {
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

        if (!row || row.__is_removed || !column?.editable) return;
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

  const replaceSearchOccurrence = React.useCallback(
    (occurrence: TableSearchOccurrence, replaceAll: boolean) => {
      if (!occurrence.canReplace || !searchState.query) return false;

      const row = serializedRowsRef.current[occurrence.rowIndex];
      const column = columnsRef.current[occurrence.colIndex];
      if (!row || row.__is_removed || !column?.editable) return false;
      if (column.type === 'autocomplete' || column.type === 'autocomplete-multi') return false;

      const value = getResolvedCellValue(row, column);
      const serializedValue = serializeTableValue(value, column.type, { nullAsEmpty: true });
      const nextValue = replaceSearchValue(
        serializedValue,
        searchState.query,
        searchState.replace,
        {
          matchCase: searchState.matchCase,
          wholeWord: searchState.wholeWord,
        },
        replaceAll,
      );

      if (nextValue === serializedValue) return false;

      onSaveCell(row.__index_row, String(column.attribute), nextValue, true, false);

      return true;
    },
    [
      getResolvedCellValue,
      onSaveCell,
      searchState.matchCase,
      searchState.query,
      searchState.replace,
      searchState.wholeWord,
    ],
  );

  const handleReplaceCurrent = React.useCallback(() => {
    if (!activeSearchOccurrence) return;

    replaceSearchOccurrence(activeSearchOccurrence, false);
  }, [activeSearchOccurrence, replaceSearchOccurrence]);

  const handleReplaceAll = React.useCallback(() => {
    searchOccurrences.forEach((occurrence) => replaceSearchOccurrence(occurrence, true));
    setSearchState((prevState) => ({ ...prevState, activeIndex: 0 }));
  }, [replaceSearchOccurrence, searchOccurrences]);

  const onBlurCell = React.useCallback(() => {
    setCellEditingKey(null);
    setCellEditInitialValue(undefined);
    refScrollContainer.current?.focus();
  }, []);

  const handleDoubleClickCell = React.useCallback(
    (rowColumnKey: string) => {
      const [keyRow, attribute] = rowColumnKey.split(':');
      const columnIndex = columnsRef.current.findIndex(
        (item) => String(item.attribute) === attribute,
      );
      const row = serializedRowsRef.current.find((item) => String(item.__key_row) === keyRow);
      const column = columnsRef.current[columnIndex];

      if (!row || row.__is_removed || !column?.editable) return;

      scrollCellIntoView(row.__index_row, columnIndex);
      setCellEditInitialValue(undefined);
      setCellEditingKey(rowColumnKey);
    },
    [scrollCellIntoView],
  );

  const notifySelectedCell = React.useCallback(
    (rowIndex: number, colIndex: number) => {
      const row = serializedRowsRef.current[rowIndex];
      const column = columnsRef.current[colIndex];

      if (!row || !column) return;

      const value = getResolvedCellValue(row, column);

      onSelectCellData?.({
        row,
        column,
        value,
        rowIndex,
        colIndex,
      });
    },
    [getResolvedCellValue, onSelectCellData],
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

      if (isPrimaryShortcutPressed()) {
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
    (colIndex: number, event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      const rows = serializedRowsRef.current;
      if (!rows.length) return;

      const anchor = lastSelectedCellRef.current;
      const shouldAppend = isPrimaryShortcutPressed(event);
      const shouldSelectRange = event.shiftKey && !shouldAppend && anchor;

      if (!shouldSelectRange) {
        lastSelectedCellRef.current = { rowIndex: 0, colIndex };
      }

      arrowCursorRef.current = { rowIndex: 0, colIndex };
      notifySelectedCell(0, colIndex);

      setSelectedCells((prev) => {
        const next = shouldAppend ? new Set(prev) : new Set<string>();
        const minCol = shouldSelectRange ? Math.min(anchor.colIndex, colIndex) : colIndex;
        const maxCol = shouldSelectRange ? Math.max(anchor.colIndex, colIndex) : colIndex;

        rows.forEach((_, rowIndex) => {
          for (let columnIndex = minCol; columnIndex <= maxCol; columnIndex++) {
            next.add(cellKey(rowIndex, columnIndex));
          }
        });

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

      if (isPrimaryShortcutPressed()) {
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
    (rowIndex: number, colIndex: number, event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      if (event.button !== 0 || isPrimaryShortcutPressed(event) || event.shiftKey) return;
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
    (rowIndex: number, colIndex: number, event: React.MouseEvent<HTMLElement, MouseEvent>) => {
      if (event.button !== 0 || isPrimaryShortcutPressed(event) || event.shiftKey) return;
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

  const handleSelectAllCells = React.useCallback(() => {
    const totalColumns = columnsRef.current.length;
    if (!totalColumns) return false;

    if (analysisModeRef.current) {
      const rowsToAnalyze = analysisRowsRef.current;
      if (!rowsToAnalyze.length) return false;

      const next = new Set<string>();
      rowsToAnalyze.forEach((row) => {
        for (let colIndex = 0; colIndex < totalColumns; colIndex++) {
          next.add(cellKey(row.__index_row, colIndex));
        }
      });

      const firstCell = { rowIndex: rowsToAnalyze[0].__index_row, colIndex: 0 };
      lastAnalysisSelectedCellRef.current = firstCell;
      analysisArrowCursorRef.current = firstCell;
      setAnalysisSelectedCells(next);
      notifySelectedCell(firstCell.rowIndex, firstCell.colIndex);

      return true;
    }

    const rows = serializedRowsRef.current;
    if (!rows.length) return false;

    const next = new Set<string>();
    rows.forEach((_, rowIndex) => {
      for (let colIndex = 0; colIndex < totalColumns; colIndex++) {
        next.add(cellKey(rowIndex, colIndex));
      }
    });

    const firstCell = { rowIndex: 0, colIndex: 0 };
    lastSelectedCellRef.current = firstCell;
    arrowCursorRef.current = firstCell;
    setSelectedCells(next);
    notifySelectedCell(firstCell.rowIndex, firstCell.colIndex);

    return true;
  }, [notifySelectedCell]);

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
            const row = serializedRowsRef.current[rowIndex];
            const column = columnsRef.current[ci];
            const v = getResolvedCellValue(row, column);
            return serializeTableCopyValue(v);
          })
          .join(', ');
      });

    const rowLines = [...rowMap.keys()]
      .sort((a, b) => a - b)
      .map((rowIndex) => {
        const row = serializedRowsRef.current[rowIndex];
        return columnsRef.current
          .map((col) => {
            const v = getResolvedCellValue(row, col);
            return serializeTableCopyValue(v);
          })
          .join(', ');
      });

    const sortedRowIndices = [...rowMap.keys()].sort((a, b) => a - b);

    const rowObjects = sortedRowIndices.map((rowIndex) => {
      const row = serializedRowsRef.current[rowIndex];
      return Object.fromEntries(
        columnsRef.current.map((col) => [col.attribute, getResolvedCellValue(row, col) ?? null]),
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

              return [col.attribute, getResolvedCellValue(row, col) ?? null];
            })
            .filter((entry): entry is [string, any] => !!entry),
        );
      });

    const selectedCells = [...cells]
      .map((key) => {
        const [rowIndex, colIndex] = key.split(':').map(Number);
        const row = serializedRowsRef.current[rowIndex];
        const column = columnsRef.current[colIndex];

        if (!row || !column) return null;

        return { row, column, rowIndex, colIndex };
      })
      .filter((cell): cell is ITableContextMenuCellData<Row> => !!cell);

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
      selectedCells,
    });
  };

  const enterAnalysisMode = React.useCallback(
    (
      rowsToAnalyze: Array<{ __index_row: number }>,
      selectedCells: Set<string>,
      anchor?: TableCellPosition | null,
    ) => {
      if (!rowsToAnalyze.length) return;

      const firstColumnMinSize = Math.ceil(
        Math.max(
          0,
          ...columnsRef.current.map((column) =>
            calculateTextHtmlWidth(`${column.label} ${column.info ?? ''}`),
          ),
        ) +
          40,
      );
      const rowColumnsMinSize = rowsToAnalyze.map((row) =>
        Math.ceil(calculateTextHtmlWidth(`Linha #${Number(row.__index_row) + 1}`) + 40),
      );
      const minSizes = [firstColumnMinSize, ...rowColumnsMinSize];
      const sizes = minSizes.map((size) => {
        const defaultSize = size > defaultColumnSize ? size : defaultColumnSize;
        return defaultSize > maxColumnSize ? maxColumnSize : defaultSize;
      });
      const fallbackCell = selectedCells.size
        ? (() => {
            const [rowIndex, colIndex] = [...selectedCells][0].split(':').map(Number);
            return { rowIndex, colIndex };
          })()
        : { rowIndex: rowsToAnalyze[0].__index_row, colIndex: 0 };

      setAnalysisRows(rowsToAnalyze);
      setAnalysisMinColumnsSize(minSizes);
      setAnalysisColumnsSize(sizes);
      setAnalysisSelectedCells(
        selectedCells.size
          ? new Set(selectedCells)
          : new Set([cellKey(fallbackCell.rowIndex, fallbackCell.colIndex)]),
      );
      lastAnalysisSelectedCellRef.current = anchor ?? fallbackCell;
      analysisArrowCursorRef.current = anchor ?? fallbackCell;
      captureDefaultScroll();
      setAnalysisMode(true);
    },
    [captureDefaultScroll, defaultColumnSize, maxColumnSize],
  );

  const resetAnalysisMode = React.useCallback(() => {
    setAnalysisMode(false);
    setAnalysisRows([]);
    setAnalysisColumnsSize([]);
    setAnalysisMinColumnsSize([]);
    setAnalysisSelectedCells(new Set());
    lastAnalysisSelectedCellRef.current = null;
    analysisArrowCursorRef.current = null;
  }, []);

  React.useEffect(() => {
    const nextActiveIndex = searchOccurrences.length
      ? Math.min(searchState.activeIndex, searchOccurrences.length - 1)
      : 0;

    if (nextActiveIndex === searchState.activeIndex) return;

    setSearchState((prevState) => ({ ...prevState, activeIndex: nextActiveIndex }));
  }, [searchOccurrences.length, searchState.activeIndex]);

  React.useEffect(() => {
    if (!searchState.open) return;

    updateSearchOverlayPosition();
    window.addEventListener('resize', updateSearchOverlayPosition);

    return () => {
      window.removeEventListener('resize', updateSearchOverlayPosition);
    };
  }, [
    heightBodyContainer,
    searchState.open,
    updateSearchOverlayPosition,
    widthBodyContainer,
  ]);

  React.useEffect(() => {
    if (!searchState.open || !activeSearchOccurrence) return;

    scrollCellIntoView(activeSearchOccurrence.rowIndex, activeSearchOccurrence.colIndex);
  }, [activeSearchOccurrence, scrollCellIntoView, searchState.open]);

  React.useEffect(() => {
    window.addEventListener('mouseup', handleEndCellDrag);

    return () => {
      window.removeEventListener('mouseup', handleEndCellDrag);
    };
  }, [handleEndCellDrag]);

  React.useEffect(() => {
    return () => {
      if (searchCloseTimeoutRef.current) {
        window.clearTimeout(searchCloseTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    const cb = (ev: KeyboardEvent) => {
      const targetElement = ev.target instanceof HTMLElement ? ev.target : null;
      if (targetElement?.closest(`.${styles.table_search_bar}`)) return;

      if (ev.key === 'Escape' && searchState.open && !cellEditingKeyRef.current) {
        ev.preventDefault();
        handleCloseTableSearch();
        return;
      }

      const isFind = isPrimaryShortcutPressed(ev) && !ev.shiftKey && !ev.altKey && ev.key?.toLowerCase() === 'f';

      if (isFind) {
        ev.preventDefault();
        handleOpenTableSearch();
        return;
      }

      const isSelectAll = isPrimaryShortcutPressed(ev) && ev.key?.toLowerCase() === 'a';

      if (isSelectAll && !cellEditingKeyRef.current && handleSelectAllCells()) {
        ev.preventDefault();
        return;
      }

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
          enterAnalysisMode(rowsToAnalyze, selectedCellsRef.current, lastSelectedCellRef.current);
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

        if (!row || row.__is_removed || !column?.editable) return;

        scrollCellIntoView(anchor.rowIndex, anchor.colIndex);
        setCellEditInitialValue(undefined);
        setCellEditingKey(`${row.__key_row}:${String(column.attribute)}`);
      }

      const isTypingEditKey =
        ev.key.length === 1 &&
        ev.key !== ' ' &&
        !isPrimaryShortcutPressed(ev) &&
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

        if (!row || row.__is_removed || !column?.editable) return;

        ev.preventDefault();
        scrollCellIntoView(anchor.rowIndex, anchor.colIndex);
        setCellEditInitialValue(ev.key);
        setCellEditingKey(`${row.__key_row}:${String(column.attribute)}`);
      }

      const isCopy = isPrimaryShortcutPressed() && ev.key?.toLowerCase() === 'c';

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
                  const value = getResolvedCellValue(row, col);
                  return serializeTableCopyValue(value);
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
  }, [
    analysisMode,
    enterAnalysisMode,
    handleCloseTableSearch,
    handleOpenTableSearch,
    getResolvedCellValue,
    handleSelectAllCells,
    scrollCellIntoView,
    searchState.open,
  ]);

  React.useEffect(() => {
    const cb = (ev: KeyboardEvent) => {
      const targetElement = ev.target instanceof HTMLElement ? ev.target : null;
      if (targetElement?.closest(`.${styles.table_search_bar}`)) return;

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
        scrollAnalysisCellIntoView(target.rowIndex, target.colIndex);

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
  }, [
    notifySelectedCell,
    rowNumberColumnWidth,
    scrollAnalysisCellIntoView,
    selectAnalysisRange,
    selectDefaultRange,
  ]);

  React.useEffect(() => {
    const defaultColumnsSize = columns.map((column) => {
      return Math.ceil(calculateTextHtmlWidth(`${column.label} ${column.info ?? ''}`) + 40);
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
      const targetElement = event.target instanceof HTMLElement ? event.target : null;
      if (targetElement?.closest(`.${styles.table_search_bar}`)) return;
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

        if (!row || row.__is_removed || !column?.editable || value === undefined) return [];
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
    if (
      !initialAnalysisMode ||
      initialAnalysisModeAppliedRef.current ||
      analysisMode ||
      !serializedRows.length ||
      !columns.length
    )
      return;

    initialAnalysisModeAppliedRef.current = true;

    const firstCell = { rowIndex: serializedRows[0].__index_row, colIndex: 0 };

    enterAnalysisMode(
      serializedRows,
      new Set([cellKey(firstCell.rowIndex, firstCell.colIndex)]),
      firstCell,
    );
  }, [analysisMode, columns.length, enterAnalysisMode, initialAnalysisMode, serializedRows]);

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
      style={containerStyle}
      tabIndex={0}
    >
      {!!loading && <MultiplesBarLoading zIndex={7} />}

      {searchState.open && (
        <TableSearchBar
          query={searchState.query}
          replace={searchState.replace}
          replaceOpen={searchState.replaceOpen}
          matchCase={searchState.matchCase}
          wholeWord={searchState.wholeWord}
          activeIndex={activeSearchIndex}
          total={searchOccurrences.length}
          canReplaceCurrent={canReplaceCurrent}
          canReplaceAll={canReplaceAll}
          closing={searchClosing}
          onQueryChange={handleSearchQueryChange}
          onReplaceChange={handleReplaceChange}
          onReplaceOpenChange={handleReplaceOpenChange}
          onToggleMatchCase={handleToggleMatchCase}
          onToggleWholeWord={handleToggleWholeWord}
          onReplaceCurrent={handleReplaceCurrent}
          onReplaceAll={handleReplaceAll}
          onNext={handleSearchNext}
          onPrevious={handleSearchPrevious}
          onClose={handleCloseTableSearch}
        />
      )}

      {analysisMode ? (
        <TableAnalysisView
          columns={columns}
          rows={analysisRows}
          rowHeight={rowHeight}
          columnsSize={visibleAnalysisColumnsSize}
          minColumnsSize={visibleAnalysisMinColumnsSize}
          editedRows={editedRows}
          newRows={newRows}
          cellEditingKey={cellEditingKey}
          cellEditInitialValue={cellEditInitialValue}
          scrollContainerRef={refAnalysisScrollContainer}
          selectedCells={analysisSelectedCells}
          searchMatches={searchMatchKeys}
          activeSearchCellKey={activeSearchCellKey}
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
          searchMatches={searchMatchKeys}
          activeSearchCellKey={activeSearchCellKey}
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
