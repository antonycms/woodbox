import React from 'react';
import { calculateTextHtmlWidth } from '@renderer/utils/methods';
import type { IColumn } from '../dtos';
import { DEFAULT_COLUMN_SIZE } from '../constants';

interface UseTableColumnSizingParams<Row = any> {
  columns: IColumn<Row>[];
}

export const useTableColumnSizing = <Row,>({
  columns,
}: UseTableColumnSizingParams<Row>) => {
  const [columnsSize, setColumnsSize] = React.useState<number[]>([]);
  const [minColumnsSize, setMinColumnsSize] = React.useState<number[]>([]);

  React.useEffect(() => {
    const defaultColumnsSize = columns.map((column) => {
      return Math.ceil(calculateTextHtmlWidth(`${column.label} ${column.info ?? ''}`) + 40);
    });

    setColumnsSize((prevState) => {
      if (prevState.length === columns.length) return prevState;

      return defaultColumnsSize.map((size) =>
        size > DEFAULT_COLUMN_SIZE ? size : DEFAULT_COLUMN_SIZE,
      );
    });

    setMinColumnsSize((prevState) => {
      const isSameState =
        prevState.length === defaultColumnsSize.length &&
        prevState.every((size, index) => size === defaultColumnsSize[index]);

      return isSameState ? prevState : defaultColumnsSize;
    });
  }, [columns]);

  return {
    columnsSize,
    minColumnsSize,
    setColumnsSize,
  };
};
