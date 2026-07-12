import React from 'react';
import { Button } from '@renderer/components/Button';
import { Modal } from '@renderer/components/Modal';
import { Row } from '@renderer/components/Grid';
import { Spacer } from '@renderer/components/Spacer';
import { Text } from '@renderer/components/Text';
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
    const {
      activeTheme: { __colors, modal: colors },
    } = useThemeContext();

    const { getServerOutput, clearServerOutput } = useStoreContext();

    const [showLocal, setShowLocal] = React.useState(false);
    const [messages, setMessages] = React.useState<IServerOutputMessage[]>([]);
    const listRef = React.useRef<HTMLDivElement>(null);

    const loadServerOutput = async () => {
      const messages = await getServerOutput(id_connection);
      setMessages(messages);
    };

    const handleClearServerOutput = async () => {
      await clearServerOutput(id_connection);
      setMessages([]);
    };

    const handleClose = () => {
      setShowLocal(false);
      onClose?.();
    };

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
        title="Saída do servidor"
        width="900px"
        height="520px"
        show={show || showLocal}
        onClose={handleClose}
      >
        <div ref={listRef} className={styles.outputList} style={{ color: colors.color }}>
          {!messages.length && (
            <Text color={colors.color}>Nenhuma saída capturada até o momento.</Text>
          )}

          {messages.map((message) => (
                <div
                  key={message.id}
                  className={styles.outputItem}
                  style={
                    {
                      '--server-output-background-color': __colors.darkLight,
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
            Limpar
          </Button>

          <Button
            xs={6}
            sm={4}
            md={3}
            onClick={onClose}
            color={colors.cancelButtonColor}
            backgroundColor={colors.cancelButtonBackgroundColor}
          >
            Fechar
          </Button>
        </Row>
      </Modal>
    );
  },
);

ModalServerOutput.displayName = 'ModalServerOutput';
