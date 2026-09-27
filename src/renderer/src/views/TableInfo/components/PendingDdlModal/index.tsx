import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTableInfoStore, type TableInfoStoreApi } from '@renderer/stores/TableInfo';
import { useWorkspaceStore } from '@renderer/stores/Workspace';
import { getRendererDialect } from '@renderer/database/dialects';
import ModalApplyPendingDDL from '../Properties/components/ModalApplyPendingDDL';

export const PendingDdlModal = ({ tableStore }: { tableStore: TableInfoStoreApi }) => {
  const {
    pendingDdlSql,
    showPendingDdlModal,
    applyingPendingDdl,
    pendingConnectionId,
    closePendingDdlModal,
    applyPendingChangesSql,
  } = useTableInfoStore(
    tableStore,
    useShallow((state) => ({
      pendingDdlSql: state.pendingDdlSql,
      showPendingDdlModal: state.showPendingDdlModal,
      applyingPendingDdl: state.applyingPendingDdl,
      pendingConnectionId: state.pendingConnectionId,
      closePendingDdlModal: state.closePendingDdlModal,
      applyPendingChangesSql: state.applyPendingChangesSql,
    })),
  );
  const dialect = useWorkspaceStore(
    (state) =>
      state.connections.find((connection) => connection.id === pendingConnectionId)?.dialect,
  );
  return (
    <ModalApplyPendingDDL
      show={showPendingDdlModal}
      sql={pendingDdlSql}
      applying={applyingPendingDdl}
      onClose={closePendingDdlModal}
      dialect={getRendererDialect(dialect)}
      onApply={applyPendingChangesSql}
    />
  );
};
