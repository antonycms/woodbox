import React from 'react';
import { ContextMenu, type IContextMenuOption } from '@renderer/components/ContextMenu';
import { useInsertDmlPreview } from '@renderer/hooks/useInsertDmlPreview';
import ModalGenerateDDL from '@renderer/views/TableInfo/components/Properties/components/ModalGenerateDDL';
import type { Dialect } from '@shared/types/connections';
import { useI18nStore } from '@renderer/stores/I18n';
import { copyToClipboard } from '@renderer/utils/methods';
import type { IContextMenuTable } from '../../types';

interface DataContextMenuProps {
  contextMenuTable?: IContextMenuTable;
  idConnection: string;
  resultRevision: number;
  columnNames: string[];
  dialect: Dialect;
  schema: string;
  table: string;
  isReadOnlyObject: boolean;
  onClose: () => void;
  onOpenExportModal: () => void;
  onSetSelectedCellsNull: () => void;
  onRemoveSelectedRows: () => void;
}

export const DataContextMenu = ({
  contextMenuTable,
  idConnection,
  resultRevision,
  columnNames,
  dialect,
  schema,
  table,
  isReadOnlyObject,
  onClose,
  onOpenExportModal,
  onSetSelectedCellsNull,
  onRemoveSelectedRows,
}: DataContextMenuProps) => {
  const t = useI18nStore((state) => state.t);
  const preview = useInsertDmlPreview({
    idConnection, policyId: dialect, schema, table, resultRevision, menu: contextMenuTable,
  });

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
          void preview.prepare(contextMenuTable?.data?.getRows() || [], columnNames);
        },
      },
      !isReadOnlyObject && {
        text: t('context.insertDdlSelectedCells'),
        onClick: () => {
          void preview.prepare(contextMenuTable?.data?.getSelectedCellRows() || [], columnNames);
        },
      },
    ].filter(Boolean) as IContextMenuOption[];
  }, [
    columnNames,
    contextMenuTable,
    preview.prepare,
    isReadOnlyObject,
    onOpenExportModal,
    onRemoveSelectedRows,
    onSetSelectedCellsNull,
    schema,
    table,
    t,
  ]);

  return <>
    <ContextMenu position={contextMenuTable?.position} onClose={onClose} options={contextMenuOptions} />
    <ModalGenerateDDL show={preview.show} sql={preview.sql} onClose={preview.close} />
  </>;
};
