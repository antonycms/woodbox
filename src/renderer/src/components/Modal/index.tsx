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
  const {
    show,
    title,
    onClose,
    justHide,
    children,
    closeOutside = false,
    height,
    width = '800px',
  } = props;

  const {
    activeTheme: {
      __colors,
      modal: { backgroundColor, color },
    },
  } = useThemeContext();

  const overlayRef = React.useRef<HTMLDivElement>(null);

  const styleOverlay = React.useMemo(() => {
    return {
      display: justHide && !show ? 'none' : 'unset',
      '--modal-overlay-color': __colors.overlay,
    } as React.CSSProperties;
  }, [__colors.overlay, show, justHide]);

  const styleContainer = React.useMemo(() => {
    return { backgroundColor, height, maxWidth: width };
  }, [backgroundColor, height, width]);

  const emitCloseOutside = React.useCallback(
    ({ target, currentTarget }) => {
      if (target && target !== currentTarget) return;

      onClose?.();
    },
    [onClose],
  );

  React.useEffect(() => {
    if (!closeOutside || !show) return;

    const emitCloseOnEscape = (event: KeyboardEvent) => {
      if (event.key !== 'Escape') return;

      const closeableModals = document.querySelectorAll('[data-close-outside-modal="true"]');
      const topModal = closeableModals[closeableModals.length - 1];

      if (topModal !== overlayRef.current) return;

      onClose?.();
    };

    window.addEventListener('keydown', emitCloseOnEscape);

    return () => window.removeEventListener('keydown', emitCloseOnEscape);
  }, [closeOutside, onClose, show]);

  if (!show && !justHide) return;

  return ReactDOM.createPortal(
    <div
      ref={overlayRef}
      className={classes(styles.overlay, !show && justHide && styles.hidden)}
      data-close-outside-modal={closeOutside && show}
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
