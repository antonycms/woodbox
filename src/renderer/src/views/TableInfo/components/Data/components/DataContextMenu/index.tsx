import React from 'react';
import { ContextMenu, type IContextMenuOption } from '@renderer/components/ContextMenu';
import { generateInsertDdl } from '@renderer/database/ddl';
import type { RendererDialect } from '@renderer/database/dialects';
import { useI18nStore } from '@renderer/stores/I18n';
import { copyToClipboard } from '@renderer/utils/methods';
import type { IContextMenuTable } from '../../types';

interface DataContextMenuProps {
  contextMenuTable?: IContextMenuTable;
  columnNames: string[];
  dialect: RendererDialect;
  schema: string;
  table: string;
  isReadOnlyObject: boolean;
  onClose: () => void;
  onOpenExportModal: () => void;
  onSetSelectedCellsNull: () => void;
  onRemoveSelectedRows: () => void;
  onSetDdlSql: (sql: string) => void;
  onShowDdlModal: () => void;
}

export const DataContextMenu = ({
  contextMenuTable,
  columnNames,
  dialect,
  schema,
  table,
  isReadOnlyObject,
  onClose,
  onOpenExportModal,
  onSetSelectedCellsNull,
  onRemoveSelectedRows,
  onSetDdlSql,
  onShowDdlModal,
}: DataContextMenuProps) => {
  const t = useI18nStore((state) => state.t);

  const contextMenuOptions = React.useMemo<IContextMenuOption[]>(() => {
    return [
      {
        text: t('common.copy'),
        onClick: () => copyToClipboard(contextMenuTable?.data?.getCellsText() || ''),
      },
      {
        text: t('context.copyRow'),
        onClick: () => copyToClipboard(contextMenuTable?.data?.getRowsText() || ''),
      },
      {
        text: t('context.copyRowJson'),
        onClick: () => copyToClipboard(contextMenuTable?.data?.getRowsJson() || ''),
      },
      {
        text: t('modal.exportData'),
        onClick: onOpenExportModal,
      },
      {
        text: t('context.setSelectedCellsNull'),
        onClick: onSetSelectedCellsNull,
        show: () =>
          !!contextMenuTable?.data?.getSelectedCells().some(({ column }) => column.editable),
      },
      !isReadOnlyObject && {
        text: t('context.deleteSelectedItems'),
        onClick: onRemoveSelectedRows,
      },
      !isReadOnlyObject && {
        text: t('context.insertDdlRow'),
        onClick: () => {
          onSetDdlSql(
            generateInsertDdl(
              dialect,
              schema,
              table,
              contextMenuTable?.data?.getRows() || [],
              columnNames,
            ),
          );
          onShowDdlModal();
        },
      },
      !isReadOnlyObject && {
        text: t('context.insertDdlSelectedCells'),
        onClick: () => {
          onSetDdlSql(
            generateInsertDdl(
              dialect,
              schema,
              table,
              contextMenuTable?.data?.getSelectedCellRows() || [],
              columnNames,
            ),
          );
          onShowDdlModal();
        },
      },
    ].filter(Boolean) as IContextMenuOption[];
  }, [
    columnNames,
    contextMenuTable,
    dialect,
    isReadOnlyObject,
    onOpenExportModal,
    onRemoveSelectedRows,
    onSetDdlSql,
    onSetSelectedCellsNull,
    onShowDdlModal,
    schema,
    table,
    t,
  ]);

  return <ContextMenu position={contextMenuTable?.position} onClose={onClose} options={contextMenuOptions} />;
};
