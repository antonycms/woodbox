import React from 'react';
import {
  MIN_ANALYSIS_FIELD_COLUMN_WIDTH,
  MIN_ANALYSIS_VALUE_COLUMN_WIDTH,
} from '../constants';

interface UseAnalysisColumnsLayoutParams {
  columnsSize: number[];
  minColumnsSize: number[];
  widthBodyContainer: number;
}

export const useAnalysisColumnsLayout = ({
  columnsSize,
  minColumnsSize,
  widthBodyContainer,
}: UseAnalysisColumnsLayoutParams) => {
  const visibleColumnsSize = React.useMemo(() => {
    if (columnsSize.length < 2 || widthBodyContainer <= 0) return columnsSize;

    const maxFieldColumnSize = Math.max(
      MIN_ANALYSIS_FIELD_COLUMN_WIDTH,
      widthBodyContainer - MIN_ANALYSIS_VALUE_COLUMN_WIDTH,
    );
    const fieldColumnSize = Math.min(columnsSize[0], maxFieldColumnSize);

    if (fieldColumnSize === columnsSize[0]) return columnsSize;

    return [fieldColumnSize, ...columnsSize.slice(1)];
  }, [columnsSize, widthBodyContainer]);

  const visibleMinColumnsSize = React.useMemo(() => {
    if (minColumnsSize.length < 2 || visibleColumnsSize.length < 2) {
      return minColumnsSize;
    }

    const fieldColumnMinSize = Math.min(
      minColumnsSize[0] ?? visibleColumnsSize[0],
      visibleColumnsSize[0],
    );

    if (fieldColumnMinSize === minColumnsSize[0]) return minColumnsSize;

    return [fieldColumnMinSize, ...minColumnsSize.slice(1)];
  }, [minColumnsSize, visibleColumnsSize]);

  return { visibleColumnsSize, visibleMinColumnsSize };
};
