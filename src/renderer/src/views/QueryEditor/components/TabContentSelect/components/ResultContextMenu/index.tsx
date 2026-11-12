import React from 'react';
import { ContextMenu, type IContextMenuOption } from '@renderer/components/ContextMenu';
import { useInsertDmlPreview } from '@renderer/hooks/useInsertDmlPreview';
import ModalGenerateDDL from '@renderer/views/TableInfo/components/Properties/components/ModalGenerateDDL';
import type { Dialect } from '@shared/types/connections';
import { useI18nStore } from '@renderer/stores/I18n';
import { copyToClipboard } from '@renderer/utils/methods';
import type { IQueryResult } from '@renderer/views/QueryEditor/dtos';
import type { IContextMenuTable } from '@renderer/views/TableInfo/components/Data';

interface ResultContextMenuProps {
  contextMenuTable?: IContextMenuTable;
  idConnection: string;
  data: IQueryResult;
  dialect: Dialect;
  editable: boolean;
  singleResultTable?: NonNullable<IQueryResult['tables_info']>[number];
  onClose: () => void;
  onOpenExportModal: () => void;
  onSetSelectedCellsNull: () => void;
  onRemoveSelectedRows: () => void;
}

export const ResultContextMenu = ({
  contextMenuTable,
  idConnection,
  data,
  dialect,
  editable,
  singleResultTable,
  onClose,
  onOpenExportModal,
  onSetSelectedCellsNull,
  onRemoveSelectedRows,
}: ResultContextMenuProps) => {
  const t = useI18nStore((state) => state.t);
  const preview = useInsertDmlPreview({
    idConnection, policyId: dialect, schema: singleResultTable?.schema, table: singleResultTable?.name,
    query: data.query, resultRevision: data.resultRevision, menu: contextMenuTable,
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
      {
        text: t('context.deleteSelectedItems'),
        onClick: onRemoveSelectedRows,
        show: () => editable,
      },
      {
        text: t('context.insertDdlRow'),
        onClick: () => {
          if (!singleResultTable) return;

          void preview.prepare(contextMenuTable?.data?.getRows() || [], data.columns);
        },
        show: () => !!singleResultTable,
      },
      {
        text: t('context.insertDdlSelectedCells'),
        onClick: () => {
          if (!singleResultTable) return;

          void preview.prepare(contextMenuTable?.data?.getSelectedCellRows() || [], data.columns);
        },
        show: () => !!singleResultTable,
      },
    ];
  }, [
    contextMenuTable,
    data.columns,
    preview.prepare,
    editable,
    onOpenExportModal,
    onRemoveSelectedRows,
    onSetSelectedCellsNull,
    singleResultTable,
    t,
  ]);

  return <>
    <ContextMenu position={contextMenuTable?.position} onClose={onClose} options={contextMenuOptions} />
    <ModalGenerateDDL show={preview.show} sql={preview.sql} onClose={preview.close} />
  </>;
};
