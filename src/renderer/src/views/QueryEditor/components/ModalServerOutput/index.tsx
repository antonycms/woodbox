import { useShallow } from 'zustand/react/shallow';
import React from 'react';
import { Button } from '@renderer/components/Button';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useI18nStore } from '@renderer/stores/I18n';
import { useThemeStore } from '@renderer/stores/Theme';
import type { IServerOutputMessage } from '@shared/types/database';
import { toDateTime } from '@renderer/utils/date';
import { useDatabaseStore } from '@renderer/stores/Database';
import styles from './styles.module.css';

interface IModalServerOutputProps {
  show?: boolean;
  id_connection: string;
  onClose(): void;
}

export const ModalServerOutput = React.memo(
  ({ show, id_connection, onClose }: IModalServerOutputProps) => {
    const t = useI18nStore((state) => state.t);
    const { queryEditor, modal: colors } = useThemeStore((state) => state.activeTheme);

    const { onServerOutput, getServerOutput, clearServerOutput } = useDatabaseStore(
      useShallow((state) => ({
        onServerOutput: state.onServerOutput,
        getServerOutput: state.getServerOutput,
        clearServerOutput: state.clearServerOutput,
      })),
    );

    const [messages, setMessages] = React.useState<IServerOutputMessage[]>([]);
    const listRef = React.useRef<HTMLDivElement>(null);

    const loadServerOutput = async () => {
      const messages = await getServerOutput(id_connection);
      setMessages(messages);
    };

    const handleClearServerOutput = React.useCallback(async () => {
      await clearServerOutput(id_connection);
      setMessages([]);
    }, [clearServerOutput, id_connection]);

    const handleClose = React.useCallback(() => {
      onClose?.();
    }, [onClose]);

    React.useEffect(() => {
      if (!show) return;
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }, [show, messages.length]);

    React.useEffect(() => {
      loadServerOutput();

      const removeListener = onServerOutput((message: IServerOutputMessage) => {
        if (message.connectionId !== id_connection) return;

        setMessages((prevState) => {
          if (prevState.some(({ id }) => id === message.id)) return prevState;
          return [...prevState, message].slice(-1000);
        });
      });

      return removeListener;
    }, [id_connection, onServerOutput]);

    return (
      <Modal
        closeOutside
        title={t('modal.serverOutput')}
        width="900px"
        height="520px"
        show={show}
        onClose={handleClose}
      >
        <div ref={listRef} className={styles.outputList} style={{ color: colors.color }}>
          {!messages.length && <Text color={colors.color}>{t('message.noServerOutput')}</Text>}

          {messages.map((message) => (
            <div
              key={message.id}
              className={styles.outputItem}
              style={
                {
                  '--server-output-background-color': queryEditor.serverOutput.backgroundColor,
                } as React.CSSProperties
              }
            >
              <Text small color={colors.color}>
                [{toDateTime(message.date)}] {message.severity || 'NOTICE'}
              </Text>

              <pre>{message.message}</pre>

              {!!message.detail && <pre>{message.detail}</pre>}
              {!!message.hint && <pre>{message.hint}</pre>}
              {!!message.where && <pre>{message.where}</pre>}
            </div>
          ))}
        </div>

        <Row>
          <Spacer />

          <Button
            xs={6}
            sm={4}
            md={3}
            disabled={!messages.length}
            onClick={handleClearServerOutput}
            color={colors.cancelButtonColor}
            backgroundColor={colors.cancelButtonBackgroundColor}
          >
            {t('common.clear')}
          </Button>

          <Button
            xs={6}
            sm={4}
            md={3}
            onClick={handleClose}
            color={colors.cancelButtonColor}
            backgroundColor={colors.cancelButtonBackgroundColor}
          >
            {t('common.close')}
          </Button>
        </Row>
      </Modal>
    );
  },
);

ModalServerOutput.displayName = 'ModalServerOutput';
