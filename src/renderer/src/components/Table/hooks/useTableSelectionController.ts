import React from 'react';
import type { TableDragSelectionState, TableSerializedRow } from '../dtos';

interface UseTableSelectionControllerParams<Row> {
  serializedRows: TableSerializedRow<Row>[];
  analysisRows: TableSerializedRow<Row>[];
}

export const useTableSelectionController = <Row>({
  serializedRows,
  analysisRows,
}: UseTableSelectionControllerParams<Row>) => {
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

  const selectedRows = React.useMemo(() => {
    const map = new Map<React.Key, TableSerializedRow<Row>>();
    selectedCells.forEach((key) => {
      const rowIndex = parseInt(key.split(':')[0], 10);
      const row = serializedRows[rowIndex];
      if (row) map.set(row.__key_row, row);
    });
    return map;
  }, [selectedCells, serializedRows]);

  const selectedRowsRef = React.useRef(selectedRows);
  selectedRowsRef.current = selectedRows;
  const selectedCellsRef = React.useRef(selectedCells);
  selectedCellsRef.current = selectedCells;
  const analysisSelectedCellsRef = React.useRef(analysisSelectedCells);
  analysisSelectedCellsRef.current = analysisSelectedCells;
  const analysisRowsRef = React.useRef(analysisRows);
  analysisRowsRef.current = analysisRows;

  return {
    analysisSelectedCells,
    setAnalysisSelectedCells,
    selectedCells,
    setSelectedCells,
    selectedRows,
    selectedRowsRef,
    selectedCellsRef,
    analysisSelectedCellsRef,
    analysisRowsRef,
    lastSelectedCellRef,
    lastAnalysisSelectedCellRef,
    dragSelectionRef,
    ignoreNextClickRef,
    analysisArrowCursorRef,
    arrowCursorRef,
  };
};
