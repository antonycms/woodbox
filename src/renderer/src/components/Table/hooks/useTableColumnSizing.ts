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
    const minColumnsSize = columns.map((column) => {
      return (
        column.minWidth ??
        Math.ceil(calculateTextHtmlWidth(`${column.label} ${column.info ?? ''}`) + 40)
      );
    });

    const defaultColumnsSize = columns.map((column, index) => {
      return column.width ?? minColumnsSize[index];
    });

    setColumnsSize((prevState) => {
      if (prevState.length === columns.length) return prevState;

      return defaultColumnsSize.map((size, index) => {
        if (columns[index].width !== undefined) return size;

        return size > DEFAULT_COLUMN_SIZE ? size : DEFAULT_COLUMN_SIZE;
      });
    });

    setMinColumnsSize((prevState) => {
      const isSameState =
        prevState.length === minColumnsSize.length &&
        prevState.every((size, index) => size === minColumnsSize[index]);

      return isSameState ? prevState : minColumnsSize;
    });
  }, [columns]);

  return {
    columnsSize,
    minColumnsSize,
    setColumnsSize,
  };
};
