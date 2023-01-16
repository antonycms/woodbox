import React from 'react';
import useResize from '@renderer/hooks/useResize';
import useStateWithDebounce from '@renderer/hooks/useStateWithDebounce';
import { calculateTextHtmlWidth } from '@renderer/utils/methods';
import { MultiplesBarLoading } from '@renderer/components/Loaders';
import styles from './styles.module.css';
import TableRow from './components/TableRow';
import TableColumn from './components/TableColumn';

interface IColumn {
  label: string;
  attribute: string;
  resizable?: boolean;
  sortable?: boolean;
  editable?: boolean;
  type?: 'text' | 'number' | 'select';
  renderIcon?(): JSX.Element;
}

interface ITableProps {
  rowKeyExtractor(rowData, index: number): React.Key;
  onContextMenu?(event: React.MouseEvent<HTMLDivElement, MouseEvent>): void;
  onScrollEnd?(): void;
  rows: any[];
  columns: IColumn[];
  selectable?: boolean;
  loading?: boolean;
}

const Table = (props: ITableProps) => {
  const {
    columns = [],
    rows = [],
    loading,
    rowKeyExtractor,
    selectable,
    onContextMenu,
    onScrollEnd,
  } = props;

  if (!columns.length) {
    return (
      <div className={styles.table_outside_container}>{!!loading && <MultiplesBarLoading />}</div>
    );
  }

  const lastSelectedIndex = React.useRef<number>(null);
  const refBodyContainer = React.useRef<HTMLDivElement>();
  const rowHeight = React.useMemo(() => 35, []);
  const [selectedRows, setSelectedRows] = React.useState<Map<React.Key, any>>(new Map());
  const [columnsSize, setColumnsSize] = useStateWithDebounce<number[]>([]);
  const [minColumnsSize, setMinColumnsSize] = React.useState<number[]>([]);
  const [scroll, setScroll] = useStateWithDebounce({ left: 0, top: 0 });
  const [editingCellKey, setEditingCellKey] = React.useState<string>(null);
  const [editedFieldsRow, setEditedFieldsRow] = React.useState<Map<React.Key, any>>(new Map());
  const { height: heightBodyContainer, width: widthBodyContainer } = useResize({
    HTMLElement: refBodyContainer.current,
    ignoreZeroValue: true,
  });

  const columnsDetails = React.useMemo(() => {
    const columnsIndexToRender: number[] = [];

    let startColumnPosition = 0;
    let endColumnPosition = 0;

    for (let i = 0; i < columnsSize.length; i++) {
      const colSize = columnsSize[i];
      endColumnPosition = startColumnPosition + colSize;

      if (startColumnPosition >= scroll.left || endColumnPosition >= scroll.left) {
        columnsIndexToRender.push(i);
      }

      startColumnPosition = endColumnPosition;

      if (startColumnPosition > widthBodyContainer + scroll.left) break;
    }

    return { columnsIndexToRender };
  }, [scroll.left, widthBodyContainer, columnsSize]);

  const rowsDetails = React.useMemo(() => {
    const numberOfRowsToShowOnScreen = heightBodyContainer / rowHeight;

    let first = Math.ceil(scroll.top / rowHeight);
    first = first > 0 ? first - 1 : first;
    const last = first + numberOfRowsToShowOnScreen + 2;

    return { first, last };
  }, [rows, scroll.top, rowHeight, heightBodyContainer]);

  const virtualHeaderRow = React.useMemo(() => {
    const { first, last } = rowsDetails;
    const { columnsIndexToRender } = columnsDetails;

    return (
      <TableRow isHeader>
        {columnsIndexToRender.map((columnIndex) => {
          const column = columns[columnIndex];
          const minWidth = minColumnsSize[columnIndex];

          const onResize = (width?: number) => {
            setColumnsSize((prevState) => {
              const newState = [...prevState];

              let newWidth = width || 0;

              if (typeof width !== 'number') {
                for (let i = first; i < last; i++) {
                  const row = rows[i];
                  if (!row) continue;

                  const text = String(row[column.attribute] || '');
                  const size = Math.ceil(calculateTextHtmlWidth(text) + 40);

                  if (size > newWidth) newWidth = size;
                }

                if (newWidth < minWidth) newWidth = minWidth;
              }

              newState[columnIndex] = newWidth;

              return newState;
            });
          };

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

  const virtualRows = React.useMemo(() => {
    const { first, last } = rowsDetails;
    const { columnsIndexToRender } = columnsDetails;
    const rowsToRender = rows.slice(first, last);

    return rowsToRender.map((row, index) => {
      const indexRow = index + first;
      const keyRow = rowKeyExtractor(row, indexRow);
      const style = row.__style;
      // const isSelected = selectedRows.get(keyRow);
      // const editedValues = editedFieldsRow.get(keyRow) || {};

      // const onClickRow = () => {
      //   if (!window.shiftPressed || !lastSelectedIndex) {
      //     lastSelectedIndex.current = indexRow;
      //   }

      //   if (window.ctrlPressed) {
      //     setSelectedRows((oldMap) => {
      //       const newMap = new Map(oldMap);
      //       isSelected ? newMap.delete(keyRow) : newMap.set(keyRow, row);
      //       return newMap;
      //     });
      //   } //
      //   else if (window.shiftPressed) {
      //     if (typeof lastSelectedIndex.current === 'number') {
      //       let firstIndex = lastSelectedIndex.current;
      //       let lastIndex = indexRow;

      //       if (firstIndex > lastIndex) {
      //         lastIndex = firstIndex;
      //         firstIndex = indexRow;
      //       }

      //       setSelectedRows(() => {
      //         const newMap = new Map();

      //         for (let i = firstIndex; i < lastIndex + 1; i++) {
      //           const rowToSelect = rows[i];
      //           newMap.set(rowKeyExtractor(rowToSelect, i), rowToSelect);
      //         }

      //         return newMap;
      //       });
      //     }
      //   } //
      //   else {
      //     setSelectedRows((prevState) => {
      //       const newMap = new Map();
      //       (!isSelected || prevState.size > 1) && newMap.set(keyRow, row);
      //       return newMap;
      //     });
      //   }
      // };

      return (
        <TableRow
          key={keyRow}
          // isSelected={isSelected}
          // onClick={selectable ? () => onClickRow() : undefined}
        >
          {columnsIndexToRender.map((columnIndex) => {
            const column = columns[columnIndex];
            // const columnKey = `${keyRow}_${column.attribute}`;
            // const isEditing = editingCellKey === columnKey;
            // const editedValue = editedValues[column.attribute];
            // const isEditable = column.editable;
            // const isEdited = editedValue !== undefined;
            // const value = isEdited ? editedValue : row[column.attribute];
            const value = row[column.attribute];

            // const onSave = (newValue: string | number) => {
            //   setEditedFieldsRow((prevState) => {
            //     const newState = new Map(prevState);
            //     const oldValue = row[column.attribute];

            //     const newEditedFields = { ...editedValues, [column.attribute]: newValue };

            //     if (oldValue == newValue) delete newEditedFields[column.attribute];

            //     if (Object.keys(!newEditedFields).length) {
            //       newState.delete(keyRow);
            //     } else {
            //       newState.set(keyRow, newEditedFields);
            //     }

            //     return newState;
            //   });
            //   setEditingCellKey(null);
            // };

            return (
              <TableColumn
                key={column.attribute}
                columnIndex={columnIndex}
                indexRow={indexRow}
                rowHeight={rowHeight}
                style={style}
                // isEdited={isEdited}
                // isEditing={isEditing}
                value={value}
                // onDoubleClick={isEditable ? () => setEditingCellKey(columnKey) : undefined}
                // onSave={onSave}
              />
            );
          })}
        </TableRow>
      );
    });
  }, [
    rowKeyExtractor,
    rows,
    columns,
    rowsDetails,
    columnsDetails,
    selectedRows,
    selectable,
    editingCellKey,
  ]);

  const tableDetails = React.useMemo(() => {
    let width = 0;
    let columnsSizeStr = '';

    columnsSize.forEach((size) => {
      width += size;
      columnsSizeStr += ` ${size}px`;
    });

    return { width, columnsSizeStr };
  }, [columnsSize]);

  const onScroll = (event: React.UIEvent<HTMLDivElement, UIEvent>) => {
    const element = event.target as HTMLDivElement;

    const isEndVerticalScroll = element.offsetHeight + element.scrollTop >= element.scrollHeight;

    if (element.scrollTop !== scroll.top && isEndVerticalScroll) {
      onScrollEnd?.();
    }

    setScroll({ left: element.scrollLeft, top: element.scrollTop });
  };

  React.useEffect(() => {
    const defaultColumnsSize = columns.map((column) => {
      return Math.ceil(calculateTextHtmlWidth(column.label) + 40);
    });

    if (columnsSize.length !== columns.length) {
      setColumnsSize(defaultColumnsSize.map((size) => (size > 200 ? size : 200)));
    }

    setMinColumnsSize(defaultColumnsSize);
  }, [columns, widthBodyContainer]);

  return (
    <div
      className={styles.table_outside_container}
      onScroll={onScroll}
      ref={refBodyContainer}
      onContextMenu={onContextMenu}
    >
      {!!loading && <MultiplesBarLoading />}

      <div
        className={styles.table_container}
        style={
          {
            '--height': `${rows.length * rowHeight}px`,
            '--width': `${tableDetails.width}px`,
            '--rowHeight': `${rowHeight}px`,
            '--totalRows': rows.length,
            '--columnsSize': tableDetails.columnsSizeStr,
          } as React.CSSProperties
        }
      >
        {virtualHeaderRow}
        {virtualRows}
      </div>
    </div>
  );
};

export default Table;
