import React from 'react';
import type { IColumn, TableCellEditValue, TableMutableRef, TableSerializedRow } from '../dtos';
import styles from '../styles.module.css';
import { parseClipboardGrid } from '../utils';

interface UseTableClipboardPasteParams<Row = any> {
  scrollContainerRef: React.RefObject<HTMLDivElement | null>;
  analysisModeRef: TableMutableRef<boolean>;
  cellEditingKeyRef: TableMutableRef<string | undefined>;
  selectedCellsRef: TableMutableRef<Set<string>>;
  analysisSelectedCellsRef: TableMutableRef<Set<string>>;
  serializedRowsRef: TableMutableRef<TableSerializedRow<Row>[]>;
  columnsRef: TableMutableRef<IColumn<Row>[]>;
  onEditRow?(indexRow: number, attribute: string, value: any, rowKey?: React.Key): void;
  onEditNewRow?(rowKey: React.Key, attribute: string, value: any): void;
  onSaveCell(
    indexRow: number,
    rowColumnKey: string,
    newValue: TableCellEditValue,
    keepEditing?: boolean,
    replicateSelectedCells?: boolean,
  ): void;
}

export const useTableClipboardPaste = <Row>({
  scrollContainerRef,
  analysisModeRef,
  cellEditingKeyRef,
  selectedCellsRef,
  analysisSelectedCellsRef,
  serializedRowsRef,
  columnsRef,
  onEditRow,
  onEditNewRow,
  onSaveCell,
}: UseTableClipboardPasteParams<Row>) => {
  const handlePaste = React.useCallback(
    (event: ClipboardEvent) => {
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
    },
    [
      analysisModeRef,
      analysisSelectedCellsRef,
      cellEditingKeyRef,
      columnsRef,
      onEditNewRow,
      onEditRow,
      onSaveCell,
      selectedCellsRef,
      serializedRowsRef,
    ],
  );

  React.useEffect(() => {
    const container = scrollContainerRef.current;

    container?.addEventListener('paste', handlePaste);

    return () => {
      container?.removeEventListener('paste', handlePaste);
    };
  }, [scrollContainerRef, handlePaste]);
};
