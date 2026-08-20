import React from 'react';
import { Button } from '@renderer/components/Button';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
import { useI18n } from '@renderer/contexts/I18n';
import { useThemeContext } from '@renderer/contexts/Theme';
import { IServerOutputMessage } from '@renderer/contexts/Store/context';
import { toDateTime } from '@renderer/utils/date';
import { useStoreContext } from '@renderer/contexts/Store';
import styles from './styles.module.css';

interface IModalServerOutputProps {
  show?: boolean;
  id_connection: string;
  onClose(): void;
}

export const ModalServerOutput = React.memo(
  ({ show, id_connection, onClose }: IModalServerOutputProps) => {
    const { t } = useI18n();
    const {
      activeTheme: { queryEditor, modal: colors },
    } = useThemeContext();

    const { getServerOutput, clearServerOutput } = useStoreContext();

    const [showLocal, setShowLocal] = React.useState(false);
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
      setShowLocal(false);
      onClose?.();
    }, [onClose]);

    React.useEffect(() => {
      if (!show) return;
      listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
    }, [show, messages.length]);

    React.useEffect(() => {
      loadServerOutput();

      const removeListener = window.electron.ipcRenderer.on(
        '@event:server_output',
        (_event, message: IServerOutputMessage) => {
          if (message.connectionId !== id_connection) return;

          setMessages((prevState) => {
            if (prevState.some(({ id }) => id === message.id)) return prevState;
            return [...prevState, message].slice(-1000);
          });

          if (message.severity?.toUpperCase?.() === 'NOTICE') {
            setShowLocal(true);
          }
        },
      );

      return removeListener;
    }, [id_connection]);

    return (
      <Modal
        closeOutside
        title={t('modal.serverOutput')}
        width="900px"
        height="520px"
        show={show || showLocal}
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
