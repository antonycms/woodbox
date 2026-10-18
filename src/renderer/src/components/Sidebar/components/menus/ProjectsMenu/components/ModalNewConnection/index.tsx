import React from 'react';
import { ConnectionForm } from '@renderer/components/ConnectionForm';
import { Modal } from '@renderer/components/Modal';
import { useI18nStore } from '@renderer/stores/I18n';

export const ModalNewConnection = React.memo(
  ({ idProject, idConnection, show, onClose }: IModalNewConnectionProps) => {
    const t = useI18nStore((state) => state.t);

    return (
      <Modal
        title={idConnection ? t('modal.editConnection') : t('modal.newConnection')}
        width="500px"
        maxHeight="90vh"
        show={show}
      >
        <ConnectionForm idProject={idProject} idConnection={idConnection} onClose={onClose} />
      </Modal>
    );
  },
);

ModalNewConnection.displayName = 'ModalNewConnection';

export interface IModalNewConnectionProps {
  idProject: string;
  idConnection?: string;
  show?: boolean;
  onClose?: () => void;
}
