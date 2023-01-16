import React from 'react';
import ReactDOM from 'react-dom';
import { Divider } from '../Divider';
import { Row } from '../Grid';
import { Text } from '../Text';
import styles from './styles.module.css';

export const Modal = React.memo((props: IModalProps) => {
  const { show, title, onClose, justHide, children, closeOutside = false, width = '800px' } = props;

  const [container, setContainer] = React.useState<HTMLDivElement>();

  const emitCloseOutside = ({ target, currentTarget }) => {
    if (!closeOutside || (target && target !== currentTarget)) return;

    onClose?.();
  };

  React.useEffect(() => {
    const div = document.createElement('div');
    document.body.appendChild(div);

    setContainer(div);

    return () => div?.remove?.();
  }, []);

  if (!container || !show) return null;

  return ReactDOM.createPortal(
    <div
      className={styles.overlay}
      onClick={emitCloseOutside}
      style={{ display: justHide && !show ? 'none' : 'unset' }}
    >
      <div className={styles.container} style={{ maxWidth: width }}>
        {!!title && (
          <>
            <Row>
              <Text bold userSelect={false}>{title}</Text>
            </Row>

            <Divider color="transparent" />
          </>
        )}

        {children}
      </div>
    </div>,
    container,
  );
});

Modal.displayName = 'Modal';

interface IModalProps {
  children?: React.ReactNode;
  show?: boolean;
  closeOutside?: boolean;
  onClose?(): void;
  height?: string;
  width?: string;
  justHide?: boolean;
  title?: string;
}
