import React from 'react';

interface UseTableColumnResizeParams {
  maxColumnSize: number;
  minColumnsSize: number[];
  analysisMinColumnsSize: number[];
  setColumnsSize: React.Dispatch<React.SetStateAction<number[]>>;
  setAnalysisColumnsSize: React.Dispatch<React.SetStateAction<number[]>>;
}

const getAllowedColumnSize = (size: number, minSizeAllowed: number, maxColumnSize: number) => {
  if (size <= minSizeAllowed) return minSizeAllowed;
  if (size > maxColumnSize) return maxColumnSize;

  return size;
};

export const useTableColumnResize = ({
  maxColumnSize,
  minColumnsSize,
  analysisMinColumnsSize,
  setColumnsSize,
  setAnalysisColumnsSize,
}: UseTableColumnResizeParams) => {
  const onResize = React.useCallback(
    (index: number, size: number) => {
      const allowedSize = getAllowedColumnSize(size, minColumnsSize[index] ?? 0, maxColumnSize);

      setColumnsSize((prevState) => {
        const nextState = [...prevState];

        nextState[index] = allowedSize;

        return nextState;
      });
    },
    [maxColumnSize, minColumnsSize, setColumnsSize],
  );

  const onResizeAnalysisColumn = React.useCallback(
    (index: number, size: number) => {
      const allowedSize = getAllowedColumnSize(
        size,
        analysisMinColumnsSize[index] ?? 0,
        maxColumnSize,
      );

      setAnalysisColumnsSize((prevState) => {
        const nextState = [...prevState];

        nextState[index] = allowedSize;

        return nextState;
      });
    },
    [analysisMinColumnsSize, maxColumnSize, setAnalysisColumnsSize],
  );

  return { onResize, onResizeAnalysisColumn };
};
