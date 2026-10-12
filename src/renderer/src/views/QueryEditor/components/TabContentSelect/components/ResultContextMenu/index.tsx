import React from 'react';
import { ContextMenu, type IContextMenuOption } from '@renderer/components/ContextMenu';
import { generateInsertDdl } from '@renderer/database/ddl';
import type { RendererDialect } from '@renderer/database/dialects';
import { useI18nStore } from '@renderer/stores/I18n';
import { copyToClipboard } from '@renderer/utils/methods';
import type { IQueryResult } from '@renderer/views/QueryEditor/dtos';
import type { IContextMenuTable } from '@renderer/views/TableInfo/components/Data';

interface ResultContextMenuProps {
  contextMenuTable?: IContextMenuTable;
  data: IQueryResult;
  dialect: RendererDialect;
  editable: boolean;
  singleResultTable?: NonNullable<IQueryResult['tables_info']>[number];
  onClose: () => void;
  onOpenExportModal: () => void;
  onSetSelectedCellsNull: () => void;
  onRemoveSelectedRows: () => void;
  onSetDdlSql: (sql: string) => void;
  onShowDdlModal: () => void;
}

export const ResultContextMenu = ({
  contextMenuTable,
  data,
  dialect,
  editable,
  singleResultTable,
  onClose,
  onOpenExportModal,
  onSetSelectedCellsNull,
  onRemoveSelectedRows,
  onSetDdlSql,
  onShowDdlModal,
}: ResultContextMenuProps) => {
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
      {
        text: t('context.deleteSelectedItems'),
        onClick: onRemoveSelectedRows,
        show: () => editable,
      },
      {
        text: t('context.insertDdlRow'),
        onClick: () => {
          if (!singleResultTable) return;

          onSetDdlSql(
            generateInsertDdl(
              dialect,
              singleResultTable.schema,
              singleResultTable.name,
              contextMenuTable?.data?.getRows() || [],
              data.columns,
            ),
          );
          onShowDdlModal();
        },
        show: () => !!singleResultTable,
      },
      {
        text: t('context.insertDdlSelectedCells'),
        onClick: () => {
          if (!singleResultTable) return;

          onSetDdlSql(
            generateInsertDdl(
              dialect,
              singleResultTable.schema,
              singleResultTable.name,
              contextMenuTable?.data?.getSelectedCellRows() || [],
              data.columns,
            ),
          );
          onShowDdlModal();
        },
        show: () => !!singleResultTable,
      },
    ];
  }, [
    contextMenuTable,
    data.columns,
    dialect,
    editable,
    onOpenExportModal,
    onRemoveSelectedRows,
    onSetDdlSql,
    onSetSelectedCellsNull,
    onShowDdlModal,
    singleResultTable,
    t,
  ]);

  return <ContextMenu position={contextMenuTable?.position} onClose={onClose} options={contextMenuOptions} />;
};
