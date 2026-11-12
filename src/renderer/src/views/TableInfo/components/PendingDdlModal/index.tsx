import React from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useTableInfoStore, type TableInfoStoreApi } from '@renderer/stores/TableInfo';
import ModalApplyPendingDDL from '../Properties/components/ModalApplyPendingDDL';

export const PendingDdlModal = ({ tableStore }: { tableStore: TableInfoStoreApi }) => {
  const {
    pendingDdlSql,
    showPendingDdlModal,
    applyingPendingDdl,
    closePendingDdlModal,
    applyPendingChangesSql,
  } = useTableInfoStore(
    tableStore,
    useShallow((state) => ({
      pendingDdlSql: state.pendingDdlSql,
      showPendingDdlModal: state.showPendingDdlModal,
      applyingPendingDdl: state.applyingPendingDdl,
      closePendingDdlModal: state.closePendingDdlModal,
      applyPendingChangesSql: state.applyPendingChangesSql,
    })),
  );
  return (
    <ModalApplyPendingDDL
      show={showPendingDdlModal}
      sql={pendingDdlSql}
      applying={applyingPendingDdl}
      onClose={closePendingDdlModal}
      onApply={applyPendingChangesSql}
    />
  );
};
