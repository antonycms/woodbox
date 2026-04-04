import React from 'react';
import ReactDOM from 'react-dom';
import { useThemeContext } from '@renderer/contexts/Theme';
import { Divider } from '@renderer/components/Divider';
import { Row } from '@renderer/components/Grid';
import { Text } from '@renderer/components/Text';
import { classes } from '@renderer/styles/theme';
import styles from './styles.module.css';

const containerElement = document.getElementById('modal-root');

export const Modal = React.memo((props: IModalProps) => {
  const { show, title, onClose, justHide, children, closeOutside = false, width = '800px' } = props;

  const {
    activeTheme: {
      modal: { backgroundColor, color },
    },
  } = useThemeContext();

  const styleOverlay = React.useMemo(() => {
    return { display: justHide && !show ? 'none' : 'unset' };
  }, [show, justHide]);

  const styleContainer = React.useMemo(() => {
    return { backgroundColor, maxWidth: width };
  }, [backgroundColor, width]);

  const emitCloseOutside = React.useCallback(
    ({ target, currentTarget }) => {
      if (target && target !== currentTarget) return;

      onClose?.();
    },
    [onClose],
  );

  if (!show && !justHide) return;

  return ReactDOM.createPortal(
    <div
      className={classes(styles.overlay, !show && justHide && styles.hidden)}
      onClick={closeOutside ? emitCloseOutside : undefined}
      style={styleOverlay}
    >
      <div className={styles.container} style={styleContainer}>
        {!!title && (
          <>
            <Row>
              <Text bold userSelect={false} color={color}>
                {title}
              </Text>
            </Row>

            <Divider />
          </>
        )}

        <div className={styles.contentContainer}>{children}</div>
      </div>
    </div>,
    containerElement,
  );
});

Modal.displayName = 'Modal';

export interface IModalProps {
  children?: React.ReactNode;
  show?: boolean;
  closeOutside?: boolean;
  onClose?(): void;
  height?: string;
  width?: string;
  justHide?: boolean;
  title?: string;
}
