import React from 'react';
import type {
  TableCellPosition,
  TableMutableRef,
  TableSerializedRow,
} from '../dtos';
import { cellKey } from '../utils';

interface UseTableAnalysisModeEffectsParams<Row = any> {
  analysisMode: boolean;
  analysisModeRef: TableMutableRef<boolean>;
  analysisRowsRef: TableMutableRef<TableSerializedRow<Row>[]>;
  columnsLength: number;
  columnsSignature: string;
  initialAnalysisMode?: boolean;
  initialAnalysisModeAppliedRef: TableMutableRef<boolean>;
  serializedRows: TableSerializedRow<Row>[];
  serializedRowsRef: TableMutableRef<TableSerializedRow<Row>[]>;
  enterAnalysisMode(
    rowsToAnalyze: TableSerializedRow<Row>[],
    selectedCells: Set<string>,
    anchor?: TableCellPosition | null,
  ): void;
  resetAnalysisMode(): void;
  setAnalysisRows(rows: TableSerializedRow<Row>[]): void;
}

export const useTableAnalysisModeEffects = <Row,>({
  analysisMode,
  analysisModeRef,
  analysisRowsRef,
  columnsLength,
  columnsSignature,
  initialAnalysisMode,
  initialAnalysisModeAppliedRef,
  serializedRows,
  serializedRowsRef,
  enterAnalysisMode,
  resetAnalysisMode,
  setAnalysisRows,
}: UseTableAnalysisModeEffectsParams<Row>) => {
  React.useEffect(() => {
    resetAnalysisMode();
  }, [columnsSignature, resetAnalysisMode]);

  React.useEffect(() => {
    if (
      !initialAnalysisMode ||
      initialAnalysisModeAppliedRef.current ||
      analysisMode ||
      !serializedRows.length ||
      !columnsLength
    )
      return;

    initialAnalysisModeAppliedRef.current = true;

    const firstCell = { rowIndex: serializedRows[0].__index_row, colIndex: 0 };

    enterAnalysisMode(
      serializedRows,
      new Set([cellKey(firstCell.rowIndex, firstCell.colIndex)]),
      firstCell,
    );
  }, [
    analysisMode,
    columnsLength,
    enterAnalysisMode,
    initialAnalysisMode,
    initialAnalysisModeAppliedRef,
    serializedRows,
  ]);

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
  }, [
    analysisModeRef,
    analysisRowsRef,
    resetAnalysisMode,
    serializedRows,
    serializedRowsRef,
    setAnalysisRows,
  ]);
};
