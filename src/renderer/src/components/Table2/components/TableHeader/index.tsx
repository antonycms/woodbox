import { calculateTextHtmlWidth } from '@renderer/utils/methods';
import React from 'react';
import { IColumn } from '../../dtos';
import TableColumn from '../TableColumn';
import TableRow from '../TableRow';

interface ITableHeader {
  height: number;
  columns: IColumn[];
  indexColumnsToRender: number[];
  onResizeColumn?(column: IColumn, size: number, index: number, minColumnsSize: number): void;
  onClick?(column: IColumn): void;
  onDoubleClick?(column: IColumn): void;
}

export const TableHeader2 = (props: ITableHeader) => {
  const {
    height,
    onResizeColumn,
    onClick,
    onDoubleClick,
    columns = [],
    indexColumnsToRender = [],
  } = props;
  const [minColumnsSize, setMinColumnsSize] = React.useState(new Map<string, number>());

  const onResize = (column: IColumn, size: number, index: number) => {
    if (!onResizeColumn) return;

    const minSizeAllowed = minColumnsSize.get(column.attribute);
    const allowedSize = size <= minSizeAllowed ? minSizeAllowed : size;

    onResizeColumn(column, allowedSize, index, minSizeAllowed);
  };

  React.useEffect(() => {
    setMinColumnsSize(() => {
      const newState = new Map();

      columns.forEach((column) => {
        const size = Math.ceil(calculateTextHtmlWidth(column.label) + 40);
        newState.set(column.attribute, size);
      });

      return newState;
    });
  }, [columns]);

  return (
    <TableRow isHeader>
      {indexColumnsToRender.map((columnIndex) => {
        const column = columns[columnIndex];
        const minWidth = minColumnsSize[columnIndex];

        return (
          <TableColumn
            key={column.attribute}
            resizable
            columnIndex={columnIndex}
            rowHeight={height}
            onResize={(e) => onResize(column, e.width, columnIndex)}
            onClick={onClick ? () => onClick(column) : undefined}
            onDoubleClick={onDoubleClick ? () => onDoubleClick(column) : undefined}
            minWidth={minWidth}
            value={column.label}
          />
        );
      })}
    </TableRow>
  );
};

export const TableHeader = React.memo(TableHeader2);
