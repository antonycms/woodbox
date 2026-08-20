import React from 'react';
import type { IColumn } from '../../dtos';
import styles from '../../styles.module.css';
import { classes } from '@renderer/styles/theme';
import ResizableContainer, { type OnResizeCallback } from '@renderer/components/ResizableContainer';
import { Autocomplete } from '@renderer/components/AutocompleteBlank';
import { AutocompleteMultiBlank } from '@renderer/components/AutocompleteMultiBlank';
import { useI18n } from '@renderer/contexts/I18n';
import { getPrimaryShortcutKeyLabel, isPrimaryShortcutPressed } from '@renderer/utils/keyboard';
import { serializeTableValue } from '../../utils';

type TableCellEditValue = string | number | (string | number)[];

interface ITableAnalysisViewProps<Row = any> {
  columns: IColumn<Row>[];
  rows: Row[];
  rowHeight: number;
  columnsSize: number[];
  minColumnsSize: number[];
  editedRows?: Map<React.Key, any>;
  newRows?: Map<React.Key, any>;
  cellEditingKey?: string;
  cellEditInitialValue?: string | number;
  scrollContainerRef?: React.RefObject<HTMLDivElement | null>;
  selectedCells?: Set<string>;
  searchMatches?: Set<string>;
  activeSearchCellKey?: string;
  onResizeColumn?(index: number, size: number): void;
  onDoubleClick?(rowColumnKey: string): void;
  onBlurCell?(): void;
  onEditCell?(
    rowIndex: number,
    attribute: string,
    value: TableCellEditValue,
    keepEditing?: boolean,
  ): void;
  onSelectCell?(rowIndex: number, colIndex: number): void;
  onStartCellDrag?(
    rowIndex: number,
    colIndex: number,
    event: React.MouseEvent<HTMLElement, MouseEvent>,
  ): void;
  onMoveCellDrag?(rowIndex: number, colIndex: number): void;
  onCellLinkClick?(attribute: string, value: any): void;
  onCellLinkPreviewClick?(attribute: string, value: any): void;
  cellLinkClickMode?: 'ctrl' | 'single';
}

const analysisLinkStyle: React.CSSProperties = {
  textDecoration: 'underline dotted',
  cursor: 'pointer',
};

const primaryShortcutKeyLabel = getPrimaryShortcutKeyLabel();

interface ITableAnalysisHeaderProps {
  columnIndex: number;
  width?: number;
  minWidth?: number;
  rowHeight: number;
  children: React.ReactNode;
  onResizeColumn?(index: number, size: number): void;
}

const TableAnalysisHeader = React.memo(
  ({
    columnIndex,
    width,
    minWidth,
    rowHeight,
    children,
    onResizeColumn,
  }: ITableAnalysisHeaderProps) => {
    const handleResize = React.useCallback<OnResizeCallback>(
      (size) => onResizeColumn?.(columnIndex, size.width || 0),
      [columnIndex, onResizeColumn],
    );

    return (
      <ResizableContainer
        className={styles.analysis_header}
        width={width}
        minWidth={minWidth}
        height={rowHeight}
        onResize={handleResize}
      >
        {children}
      </ResizableContainer>
    );
  },
);

interface ITableAnalysisValueProps {
  rowIndex: number;
  columnIndex: number;
  rowColumnKey: string;
  attribute: string;
  value: any;
  serializedValue: string;
  isEdited?: boolean;
  isSelected?: boolean;
  isSearchMatch?: boolean;
  isActiveSearchMatch?: boolean;
  isLinkClickable?: boolean;
  linkTitle?: string;
  linkClickMode: 'ctrl' | 'single';
  onDoubleClick?(rowColumnKey: string): void;
  onSelectCell?(rowIndex: number, colIndex: number): void;
  onStartCellDrag?(
    rowIndex: number,
    colIndex: number,
    event: React.MouseEvent<HTMLElement, MouseEvent>,
  ): void;
  onMoveCellDrag?(rowIndex: number, colIndex: number): void;
  onCellLinkClick?(attribute: string, value: any): void;
  onCellLinkPreviewClick?(attribute: string, value: any): void;
}

const TableAnalysisValue = React.memo(
  ({
    rowIndex,
    columnIndex,
    rowColumnKey,
    attribute,
    value,
    serializedValue,
    isEdited,
    isSelected,
    isSearchMatch,
    isActiveSearchMatch,
    isLinkClickable,
    linkTitle,
    linkClickMode,
    onDoubleClick,
    onSelectCell,
    onStartCellDrag,
    onMoveCellDrag,
    onCellLinkClick,
    onCellLinkPreviewClick,
  }: ITableAnalysisValueProps) => {
    const className = React.useMemo(() => {
      return classes(
        styles.analysis_value,
        isEdited && styles.edited,
        isSearchMatch && styles.search_match,
        isActiveSearchMatch && styles.search_active_match,
        isSelected && styles.cell_selected,
      );
    }, [isActiveSearchMatch, isEdited, isSearchMatch, isSelected]);

    const handleDoubleClick = React.useCallback(() => {
      onDoubleClick?.(rowColumnKey);
    }, [onDoubleClick, rowColumnKey]);

    const handleMouseDown = React.useCallback(
      (event: React.MouseEvent<HTMLElement, MouseEvent>) => {
        onStartCellDrag?.(rowIndex, columnIndex, event);
      },
      [columnIndex, onStartCellDrag, rowIndex],
    );

    const handleMouseEnter = React.useCallback(() => {
      onMoveCellDrag?.(rowIndex, columnIndex);
    }, [columnIndex, onMoveCellDrag, rowIndex]);

    const handleClick = React.useCallback(() => {
      onSelectCell?.(rowIndex, columnIndex);
    }, [columnIndex, onSelectCell, rowIndex]);

    const handleLinkClick = React.useCallback(
      (event: React.MouseEvent) => {
        if (linkClickMode === 'ctrl' && !isPrimaryShortcutPressed(event)) {
          onCellLinkPreviewClick?.(attribute, value);
          return;
        }

        event.preventDefault();
        event.stopPropagation();
        onCellLinkClick?.(attribute, value);
      },
      [attribute, linkClickMode, onCellLinkClick, onCellLinkPreviewClick, value],
    );

    return (
      <div
        className={className}
        title={serializedValue}
        onDoubleClick={handleDoubleClick}
        onMouseDown={handleMouseDown}
        onMouseEnter={handleMouseEnter}
        onClick={handleClick}
      >
        {isLinkClickable ? (
          <span style={analysisLinkStyle} title={linkTitle} onClick={handleLinkClick}>
            {serializedValue}
          </span>
        ) : (
          serializedValue
        )}
      </div>
    );
  },
);

const TableAnalysisInput = ({
  column,
  value,
  rowIndex,
  attribute,
  editInitialValue,
  onBlurCell,
  onEditCell,
}: {
  column: IColumn;
  value: any;
  rowIndex: number;
  attribute: string;
  editInitialValue?: string | number;
  onBlurCell?(): void;
  onEditCell?(
    rowIndex: number,
    attribute: string,
    value: TableCellEditValue,
    keepEditing?: boolean,
  ): void;
}) => {
  const inputInitialValue = editInitialValue ?? serializeTableValue(value, column.type);
  const editedValue = React.useRef<string | number>(inputInitialValue);
  const cancelEditRef = React.useRef(false);

  const handleSaveInputValue = React.useCallback(() => {
    onBlurCell?.();

    if (cancelEditRef.current) {
      cancelEditRef.current = false;
      return;
    }

    if (serializeTableValue(value, column.type) === editedValue.current) return;

    onEditCell?.(rowIndex, attribute, editedValue.current);
  }, [attribute, column.type, onBlurCell, onEditCell, rowIndex, value]);

  const handleAutocompleteChange = React.useCallback(
    ({ value: newValue }: { value: string | number }) => {
      onBlurCell?.();
      if (newValue === null || value === newValue) return;
      onEditCell?.(rowIndex, attribute, newValue);
    },
    [attribute, onBlurCell, onEditCell, rowIndex, value],
  );

  const handleAutocompleteMultiChange = React.useCallback(
    ({ value: newValue }: { value: (string | number)[] }) => {
      onEditCell?.(rowIndex, attribute, newValue, true);
    },
    [attribute, onEditCell, rowIndex],
  );

  const handleInputKeyDown = React.useCallback(
    (event: React.KeyboardEvent<HTMLInputElement>) => {
      if (event.key !== 'Escape') return;

      event.preventDefault();
      cancelEditRef.current = true;
      onBlurCell?.();
    },
    [onBlurCell],
  );

  const handleInputChange = React.useCallback((event: React.ChangeEvent<HTMLInputElement>) => {
    editedValue.current = event.target.value;
  }, []);

  if (column.type === 'autocomplete') {
    return (
      <Autocomplete
        autoFocus
        backgroundColor={'var(--backgroundColor)'}
        color={'white'}
        data={column.dataAutocomplete ?? []}
        value={value}
        name={attribute}
        containerClassName={classes(styles.analysis_value, styles.autocomplete_cell)}
        className={styles.table_autocomplete_input}
        placeholder={editedValue.current === undefined ? '' : String(editedValue.current)}
        onBlurWithoutChange={onBlurCell}
        onChange={handleAutocompleteChange}
      />
    );
  }

  if (column.type === 'autocomplete-multi') {
    return (
      <AutocompleteMultiBlank
        autoFocus
        backgroundColor={'var(--backgroundColor)'}
        color={'white'}
        data={column.dataAutocomplete ?? []}
        value={Array.isArray(value) ? value : []}
        name={attribute}
        containerClassName={classes(styles.analysis_value, styles.autocomplete_cell)}
        className={styles.table_autocomplete_input}
        placeholder={editedValue.current === undefined ? '' : String(editedValue.current)}
        onBlurWithoutChange={onBlurCell}
        onChange={handleAutocompleteMultiChange}
      />
    );
  }

  return (
    <input
      className={styles.analysis_value}
      autoFocus
      spellCheck={false}
      defaultValue={editedValue.current}
      onBlur={handleSaveInputValue}
      onKeyDown={handleInputKeyDown}
      onChange={handleInputChange}
    />
  );
};

const TableAnalysisView = ({
  columns,
  rows,
  rowHeight,
  columnsSize,
  minColumnsSize,
  editedRows,
  newRows,
  cellEditingKey,
  cellEditInitialValue,
  scrollContainerRef,
  selectedCells,
  searchMatches,
  activeSearchCellKey,
  onResizeColumn,
  onDoubleClick,
  onBlurCell,
  onEditCell,
  onSelectCell,
  onStartCellDrag,
  onMoveCellDrag,
  onCellLinkClick,
  onCellLinkPreviewClick,
  cellLinkClickMode = 'ctrl',
}: ITableAnalysisViewProps) => {
  const { t } = useI18n();
  const columnsSizeStyle = React.useMemo(() => {
    return columnsSize.map((size) => `${size}px`).join(' ');
  }, [columnsSize]);
  const containerStyle = React.useMemo(
    () => ({ '--rowHeight': `${rowHeight}px` }) as React.CSSProperties,
    [rowHeight],
  );
  const gridStyle = React.useMemo(
    () => ({ '--analysisColumnsSize': columnsSizeStyle }) as React.CSSProperties,
    [columnsSizeStyle],
  );
  const hasLinkColumns = React.useMemo(() => {
    return columns.some((column) => column.isLink);
  }, [columns]);
  const linkTitle = React.useMemo(() => {
    if (!hasLinkColumns) return undefined;

    if (cellLinkClickMode === 'single') return t('tooltip.clickOpenReferencedRow');

    return onCellLinkPreviewClick
      ? t('tooltip.previewOrOpenReferencedRow', { shortcut: primaryShortcutKeyLabel })
      : t('tooltip.ctrlClickOpenReferencedRow', { shortcut: primaryShortcutKeyLabel });
  }, [cellLinkClickMode, hasLinkColumns, onCellLinkPreviewClick, t]);

  return (
    <div ref={scrollContainerRef} className={styles.analysis_container} style={containerStyle}>
      <div className={styles.analysis_grid} style={gridStyle}>
        <TableAnalysisHeader
          columnIndex={0}
          width={columnsSize[0]}
          minWidth={minColumnsSize[0]}
          rowHeight={rowHeight}
          onResizeColumn={onResizeColumn}
        >
          {t('table.column')}
        </TableAnalysisHeader>

        {rows.map((row: any, rowIndex) => (
          <TableAnalysisHeader
            key={row.__key_row}
            columnIndex={rowIndex + 1}
            width={columnsSize[rowIndex + 1]}
            minWidth={minColumnsSize[rowIndex + 1]}
            rowHeight={rowHeight}
            onResizeColumn={onResizeColumn}
          >
            {t('table.rowNumber', { number: Number(row.__index_row) + 1 })}
          </TableAnalysisHeader>
        ))}

        {columns.map((column, columnIndex) => (
          <React.Fragment key={String(column.attribute)}>
            <div
              className={styles.analysis_field}
              title={column.info ? `${column.label} ${column.info}` : column.label}
            >
              {column.info ? (
                <span className={styles.header_content}>
                  <span className={styles.header_label}>{column.label}</span>
                  <span className={styles.header_info}>{column.info}</span>
                </span>
              ) : (
                column.label
              )}
            </div>

            {rows.map((row: any) => {
              const keyRow = row.__key_row;
              const attribute = String(column.attribute);
              const rowColumnKey = `${keyRow}:${attribute}`;
              const selectedCellKey = `${row.__index_row}:${columnIndex}`;
              const editedRow = editedRows?.get(keyRow);
              const newRow = newRows?.get(keyRow);
              const editedValue = editedRow?.[column.attribute];
              const newValue = newRow?.[column.attribute];
              const isEdited = editedValue !== undefined;
              const hasNewValue = newValue !== undefined;
              const value = hasNewValue ? newValue : isEdited ? editedValue : row[column.attribute];
              const serializedValue = serializeTableValue(value, column.type);
              const isEditing = rowColumnKey === cellEditingKey;
              const isSelected = selectedCells?.has(selectedCellKey);
              const isSearchMatch = searchMatches?.has(selectedCellKey);
              const isActiveSearchMatch = activeSearchCellKey === selectedCellKey;
              const isLinkClickable = column.isLink && value !== null && value !== undefined;
              const cellLinkTitle = isLinkClickable ? linkTitle : undefined;

              if (isEditing) {
                return (
                  <TableAnalysisInput
                    key={rowColumnKey}
                    column={column}
                    value={value}
                    rowIndex={row.__index_row}
                    attribute={attribute}
                    editInitialValue={cellEditInitialValue}
                    onBlurCell={onBlurCell}
                    onEditCell={onEditCell}
                  />
                );
              }

              return (
                <TableAnalysisValue
                  key={rowColumnKey}
                  rowIndex={row.__index_row}
                  columnIndex={columnIndex}
                  rowColumnKey={rowColumnKey}
                  attribute={attribute}
                  value={value}
                  serializedValue={serializedValue}
                  isEdited={isEdited}
                  isSelected={isSelected}
                  isSearchMatch={isSearchMatch}
                  isActiveSearchMatch={isActiveSearchMatch}
                  isLinkClickable={isLinkClickable}
                  linkTitle={cellLinkTitle}
                  linkClickMode={cellLinkClickMode}
                  onDoubleClick={onDoubleClick}
                  onStartCellDrag={onStartCellDrag}
                  onMoveCellDrag={onMoveCellDrag}
                  onSelectCell={onSelectCell}
                  onCellLinkClick={onCellLinkClick}
                  onCellLinkPreviewClick={onCellLinkPreviewClick}
                />
              );
            })}
          </React.Fragment>
        ))}
      </div>
    </div>
  );
};

export default React.memo(TableAnalysisView);
