import React from 'react';
import { IColumn } from '../../dtos';
import TableRow from '../TableRow';

interface ITableHeader {
  onResizeColumn(): void;
  columns: IColumn[];
}

export const TableHeader = (props: ITableHeader) => {
  const { columns = [], onResizeColumn } = props;

  const virtualHeaderRow = React.useMemo(() => {
    const { first, last } = rowsDetails;
    const { columnsIndexToRender } = columnsDetails;

    return (
      <TableRow isHeader>
        {columnsIndexToRender.map((columnIndex) => {
          const column = columns[columnIndex];
          const minWidth = minColumnsSize[columnIndex];

          return (
            <TableColumn
              key={column.attribute}
              resizable
              columnIndex={columnIndex}
              rowHeight={rowHeight}
              onResize={(e) => onResize(e.width)}
              onDoubleClick={() => onResize()}
              minWidth={minWidth}
              value={column.label}
            />
          );
        })}
      </TableRow>
    );
  }, [columns, columnsDetails, minColumnsSize]);
};
