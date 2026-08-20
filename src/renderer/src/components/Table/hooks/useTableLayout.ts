import React from 'react';
import { toCssProperties, type ITheme } from '@renderer/styles/theme';
import {
  DEFAULT_COLUMN_SIZE,
  MAX_COLUMN_SIZE,
  ROW_HEIGHT,
  ROW_NUMBER_COLUMN_WIDTH,
} from '../constants';

type TableScrollState = { left: number; top: number };
type TableTheme = NonNullable<ITheme['table']>;

interface UseTableLayoutParams {
  theme: TableTheme;
  columnsLength: number;
  columnsSize: number[];
  scroll: TableScrollState;
  widthBodyContainer: number;
  heightBodyContainer: number;
  serializedRowsLength: number;
  analysisRowsLength: number;
}

export const useTableLayout = ({
  theme,
  columnsLength,
  columnsSize,
  scroll,
  widthBodyContainer,
  heightBodyContainer,
  serializedRowsLength,
  analysisRowsLength,
}: UseTableLayoutParams) => {
  const rowHeight = ROW_HEIGHT;
  const maxColumnSize = MAX_COLUMN_SIZE;
  const defaultColumnSize = DEFAULT_COLUMN_SIZE;
  const rowNumberColumnWidth = ROW_NUMBER_COLUMN_WIDTH;

  const columnsDetails = React.useMemo(() => {
    const columnsIndexToRender: number[] = [];
    const length = Math.min(columnsSize.length, columnsLength);
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
  }, [columnsLength, columnsSize, rowNumberColumnWidth, scroll.left, widthBodyContainer]);

  const rowsDetails = React.useMemo(() => {
    const numberOfRowsToShowOnScreen = heightBodyContainer / rowHeight;

    let first = Math.ceil(scroll.top / rowHeight);
    let last = first + numberOfRowsToShowOnScreen;

    last = first + numberOfRowsToShowOnScreen + 4;
    first = first < 5 ? 0 : first - 4;

    return { first, last };
  }, [heightBodyContainer, rowHeight, scroll.top]);

  const tableDetails = React.useMemo(() => {
    let width = 0;
    let columnsSizeStr = '';

    columnsSize.forEach((size) => {
      width += size;
      columnsSizeStr += ` ${size}px`;
    });

    return { width, columnsSizeStr };
  }, [columnsSize]);

  const cssVars = React.useMemo(() => {
    return toCssProperties({
      ...theme,
      height: `${serializedRowsLength * rowHeight}px`,
      width: `${tableDetails.width + rowNumberColumnWidth}px`,
      rowHeight: `${rowHeight}px`,
      rowNumberColumnWidth: `${rowNumberColumnWidth}px`,
      totalRows: serializedRowsLength,
      columnsSize: tableDetails.columnsSizeStr,
      analysisRows: analysisRowsLength,
    });
  }, [
    analysisRowsLength,
    rowHeight,
    rowNumberColumnWidth,
    serializedRowsLength,
    tableDetails.columnsSizeStr,
    tableDetails.width,
    theme,
  ]);

  return {
    rowHeight,
    maxColumnSize,
    defaultColumnSize,
    rowNumberColumnWidth,
    columnsDetails,
    rowsDetails,
    tableDetails,
    cssVars,
  };
};
