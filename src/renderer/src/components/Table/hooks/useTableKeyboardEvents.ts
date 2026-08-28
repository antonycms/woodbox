import React from 'react';
import type {
  IColumn,
  TableCellPosition,
  TableCellValueResolver,
  TableMutableRef,
  TableSerializedRow,
} from '../dtos';
import styles from '../styles.module.css';
import { cellKey, serializeTableCopyValue } from '../utils';
import { copyToClipboard } from '@renderer/utils/methods';
import { isPrimaryShortcutPressed } from '@renderer/utils/keyboard';

interface UseTableKeyboardEventsParams<Row = any> {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  searchOpen: boolean;
  analysisMode: boolean;
  analysisModeRef: TableMutableRef<boolean>;
  analysisModeEnterRef: TableMutableRef<boolean>;
  cellEditingKeyRef: TableMutableRef<string | undefined>;
  selectedCellsRef: TableMutableRef<Set<string>>;
  analysisSelectedCellsRef: TableMutableRef<Set<string>>;
  selectedRowsRef: TableMutableRef<Map<React.Key, TableSerializedRow<Row>>>;
  serializedRowsRef: TableMutableRef<TableSerializedRow<Row>[]>;
  analysisRowsRef: TableMutableRef<TableSerializedRow<Row>[]>;
  columnsRef: TableMutableRef<IColumn<Row>[]>;
  lastSelectedCellRef: TableMutableRef<TableCellPosition | null>;
  lastAnalysisSelectedCellRef: TableMutableRef<TableCellPosition | null>;
  arrowCursorRef: TableMutableRef<TableCellPosition | null>;
  analysisArrowCursorRef: TableMutableRef<TableCellPosition | null>;
  handleCloseTableSearch(): void;
  handleOpenTableSearch(): void;
  handleSelectAllCells(): boolean;
  enterAnalysisMode(
    rowsToAnalyze: TableSerializedRow<Row>[],
    selectedCells: Set<string>,
    anchor?: TableCellPosition | null,
  ): void;
  getResolvedCellValue: TableCellValueResolver<Row>;
  notifySelectedCell(rowIndex: number, colIndex: number): void;
  scrollCellIntoView(rowIndex: number, colIndex: number): void;
  scrollDefaultCellIntoView(rowIndex: number, colIndex: number): void;
  scrollAnalysisCellIntoView(rowIndex: number, colIndex: number): void;
  selectDefaultRange(anchor: TableCellPosition, target: TableCellPosition): void;
  selectAnalysisRange(anchor: TableCellPosition, target: TableCellPosition): void;
  setAnalysisMode(value: boolean): void;
  setCellEditInitialValue(value: string | number | undefined): void;
  setCellEditingKey(value: string | undefined): void;
  setSelectedCells(value: Set<string>): void;
  setAnalysisSelectedCells(value: Set<string>): void;
}

const isSearchBarEvent = (event: KeyboardEvent) => {
  const targetElement = event.target instanceof HTMLElement ? event.target : null;

  return !!targetElement?.closest(`.${styles.table_search_bar}`);
};

const isNavigationKey = (key: string) =>
  ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(key);

export const useTableKeyboardEvents = <Row,>({
  scrollContainerRef,
  searchOpen,
  analysisMode,
  analysisModeRef,
  analysisModeEnterRef,
  cellEditingKeyRef,
  selectedCellsRef,
  analysisSelectedCellsRef,
  selectedRowsRef,
  serializedRowsRef,
  analysisRowsRef,
  columnsRef,
  lastSelectedCellRef,
  lastAnalysisSelectedCellRef,
  arrowCursorRef,
  analysisArrowCursorRef,
  handleCloseTableSearch,
  handleOpenTableSearch,
  handleSelectAllCells,
  enterAnalysisMode,
  getResolvedCellValue,
  notifySelectedCell,
  scrollCellIntoView,
  scrollDefaultCellIntoView,
  scrollAnalysisCellIntoView,
  selectDefaultRange,
  selectAnalysisRange,
  setAnalysisMode,
  setCellEditInitialValue,
  setCellEditingKey,
  setSelectedCells,
  setAnalysisSelectedCells,
}: UseTableKeyboardEventsParams<Row>) => {
  const getKeyboardEditTarget = React.useCallback(
    (anchor: TableCellPosition) => {
      const row = analysisModeEnterRef.current
        ? analysisRowsRef.current.find((item) => item.__index_row === anchor.rowIndex)
        : serializedRowsRef.current[anchor.rowIndex];
      const column = columnsRef.current[anchor.colIndex];

      if (!row || row.__is_removed || !column?.editable) return null;

      return { row, column };
    },
    [analysisModeEnterRef, analysisRowsRef, columnsRef, serializedRowsRef],
  );

  const startKeyboardEdit = React.useCallback(
    (anchor: TableCellPosition, initialValue?: string) => {
      const target = getKeyboardEditTarget(anchor);
      if (!target) return false;

      scrollCellIntoView(anchor.rowIndex, anchor.colIndex);
      setCellEditInitialValue(initialValue);
      setCellEditingKey(`${target.row.__key_row}:${String(target.column.attribute)}`);

      return true;
    },
    [getKeyboardEditTarget, scrollCellIntoView, setCellEditInitialValue, setCellEditingKey],
  );

  const copySelectedCells = React.useCallback(() => {
    const cells = analysisMode ? analysisSelectedCellsRef.current : selectedCellsRef.current;
    if (!cells.size) return;

    const rowMap = new Map<number, number[]>();

    cells.forEach((key) => {
      const [rowIndex, colIndex] = key.split(':').map(Number);
      if (!rowMap.has(rowIndex)) rowMap.set(rowIndex, []);
      rowMap.get(rowIndex)!.push(colIndex);
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
  }, [
    analysisMode,
    analysisSelectedCellsRef,
    columnsRef,
    getResolvedCellValue,
    selectedCellsRef,
    serializedRowsRef,
  ]);

  const handleTableActionKeyDown = React.useCallback(
    (event: KeyboardEvent) => {
      if (isSearchBarEvent(event)) return;

      if (event.key === 'Escape' && searchOpen && !cellEditingKeyRef.current) {
        event.preventDefault();
        handleCloseTableSearch();
        return;
      }

      const isFind =
        isPrimaryShortcutPressed(event) &&
        !event.shiftKey &&
        !event.altKey &&
        event.key?.toLowerCase() === 'f';

      if (isFind) {
        event.preventDefault();
        handleOpenTableSearch();
        return;
      }

      const isSelectAll = isPrimaryShortcutPressed(event) && event.key?.toLowerCase() === 'a';

      if (isSelectAll && !cellEditingKeyRef.current && handleSelectAllCells()) {
        event.preventDefault();
        return;
      }

      if (event.key === 'Tab' && !cellEditingKeyRef.current) {
        const hasSelectedRows = selectedRowsRef.current.size > 0;

        if (analysisMode) {
          event.preventDefault();
          setAnalysisMode(false);
        } else if (hasSelectedRows) {
          event.preventDefault();

          const rowsToAnalyze = [...selectedRowsRef.current.values()].sort(
            (a, b) => a.__index_row - b.__index_row,
          );

          enterAnalysisMode(rowsToAnalyze, selectedCellsRef.current, lastSelectedCellRef.current);
        }
      }

      if (event.key === 'Enter' && !cellEditingKeyRef.current) {
        const anchor = analysisModeEnterRef.current
          ? lastAnalysisSelectedCellRef.current
          : lastSelectedCellRef.current;

        if (!anchor) return;

        event.preventDefault();
        startKeyboardEdit(anchor);
      }

      const isTypingEditKey =
        event.key.length === 1 &&
        event.key !== ' ' &&
        !isPrimaryShortcutPressed(event) &&
        !event.altKey &&
        !event.isComposing &&
        !cellEditingKeyRef.current;

      if (isTypingEditKey) {
        const anchor = analysisModeEnterRef.current
          ? lastAnalysisSelectedCellRef.current
          : lastSelectedCellRef.current;

        if (!anchor) return;
        if (!startKeyboardEdit(anchor, event.key)) return;

        event.preventDefault();
      }

      const isCopy = isPrimaryShortcutPressed() && event.key?.toLowerCase() === 'c';

      if (isCopy) {
        copySelectedCells();
      }
    },
    [
      analysisMode,
      analysisModeEnterRef,
      cellEditingKeyRef,
      copySelectedCells,
      enterAnalysisMode,
      handleCloseTableSearch,
      handleOpenTableSearch,
      handleSelectAllCells,
      lastAnalysisSelectedCellRef,
      lastSelectedCellRef,
      searchOpen,
      selectedCellsRef,
      selectedRowsRef,
      setAnalysisMode,
      startKeyboardEdit,
    ],
  );

  const handleAnalysisNavigation = React.useCallback(
    (event: KeyboardEvent) => {
      if (cellEditingKeyRef.current || !isNavigationKey(event.key)) return false;

      event.preventDefault();

      const rowsToAnalyze = analysisRowsRef.current;
      const totalRows = rowsToAnalyze.length;
      const totalFields = columnsRef.current.length;
      if (!totalRows || !totalFields) return true;

      const anchor = lastAnalysisSelectedCellRef.current;
      const fallbackCell = {
        rowIndex: rowsToAnalyze[0].__index_row,
        colIndex: 0,
      };
      const cursor = analysisArrowCursorRef.current ?? anchor ?? fallbackCell;
      const isTableBoundaryShortcut =
        isPrimaryShortcutPressed(event) && ['Home', 'End'].includes(event.key);
      let fieldIndex = cursor.colIndex;
      let rowPosition = rowsToAnalyze.findIndex((row) => row.__index_row === cursor.rowIndex);

      if (rowPosition === -1) rowPosition = 0;

      if (event.key === 'Home') {
        if (isTableBoundaryShortcut) fieldIndex = 0;
        rowPosition = 0;
      } else if (event.key === 'End') {
        if (isTableBoundaryShortcut) fieldIndex = totalFields - 1;
        rowPosition = totalRows - 1;
      } else if (event.key === 'ArrowUp') fieldIndex = Math.max(0, fieldIndex - 1);
      else if (event.key === 'ArrowDown') fieldIndex = Math.min(totalFields - 1, fieldIndex + 1);
      else if (event.key === 'ArrowLeft') rowPosition = Math.max(0, rowPosition - 1);
      else if (event.key === 'ArrowRight') rowPosition = Math.min(totalRows - 1, rowPosition + 1);

      const target = {
        rowIndex: rowsToAnalyze[rowPosition].__index_row,
        colIndex: fieldIndex,
      };

      analysisArrowCursorRef.current = target;

      if (event.shiftKey && anchor) {
        selectAnalysisRange(anchor, target);
      } else {
        lastAnalysisSelectedCellRef.current = target;
        setAnalysisSelectedCells(new Set([cellKey(target.rowIndex, target.colIndex)]));
      }

      notifySelectedCell(target.rowIndex, target.colIndex);
      scrollAnalysisCellIntoView(target.rowIndex, target.colIndex);

      return true;
    },
    [
      analysisArrowCursorRef,
      analysisRowsRef,
      cellEditingKeyRef,
      columnsRef,
      lastAnalysisSelectedCellRef,
      notifySelectedCell,
      scrollAnalysisCellIntoView,
      selectAnalysisRange,
      setAnalysisSelectedCells,
    ],
  );

  const handleDefaultNavigation = React.useCallback(
    (event: KeyboardEvent) => {
      const anchor = lastSelectedCellRef.current;
      if (!anchor || cellEditingKeyRef.current || !isNavigationKey(event.key)) return;

      event.preventDefault();

      const totalRows = serializedRowsRef.current.length;
      const totalCols = columnsRef.current.length;
      const cursor = arrowCursorRef.current ?? anchor;
      const isTableBoundaryShortcut =
        isPrimaryShortcutPressed(event) && ['Home', 'End'].includes(event.key);
      let { rowIndex, colIndex } = cursor;

      if (event.key === 'Home') {
        if (isTableBoundaryShortcut) rowIndex = 0;
        colIndex = 0;
      } else if (event.key === 'End') {
        if (isTableBoundaryShortcut) rowIndex = totalRows - 1;
        colIndex = totalCols - 1;
      } else if (event.key === 'ArrowUp') rowIndex = Math.max(0, rowIndex - 1);
      else if (event.key === 'ArrowDown') rowIndex = Math.min(totalRows - 1, rowIndex + 1);
      else if (event.key === 'ArrowLeft') colIndex = Math.max(0, colIndex - 1);
      else if (event.key === 'ArrowRight') colIndex = Math.min(totalCols - 1, colIndex + 1);

      arrowCursorRef.current = { rowIndex, colIndex };

      if (event.shiftKey) {
        selectDefaultRange(anchor, { rowIndex, colIndex });
      } else {
        lastSelectedCellRef.current = { rowIndex, colIndex };
        setSelectedCells(new Set([cellKey(rowIndex, colIndex)]));
      }

      notifySelectedCell(rowIndex, colIndex);
      scrollDefaultCellIntoView(rowIndex, colIndex);
    },
    [
      arrowCursorRef,
      cellEditingKeyRef,
      columnsRef,
      lastSelectedCellRef,
      notifySelectedCell,
      scrollDefaultCellIntoView,
      selectDefaultRange,
      serializedRowsRef,
      setSelectedCells,
    ],
  );

  const handleTableNavigationKeyDown = React.useCallback(
    (event: KeyboardEvent) => {
      if (isSearchBarEvent(event)) return;

      if (analysisModeRef.current) {
        handleAnalysisNavigation(event);
        return;
      }

      handleDefaultNavigation(event);
    },
    [analysisModeRef, handleAnalysisNavigation, handleDefaultNavigation],
  );

  React.useEffect(() => {
    const container = scrollContainerRef.current;

    container?.addEventListener?.('keydown', handleTableActionKeyDown);

    return () => {
      container?.removeEventListener?.('keydown', handleTableActionKeyDown);
    };
  }, [handleTableActionKeyDown, scrollContainerRef]);

  React.useEffect(() => {
    const container = scrollContainerRef.current;

    container?.addEventListener?.('keydown', handleTableNavigationKeyDown);

    return () => {
      container?.removeEventListener?.('keydown', handleTableNavigationKeyDown);
    };
  }, [handleTableNavigationKeyDown, scrollContainerRef]);
};
