import React from 'react';
import { useThemeContext } from '@renderer/contexts/Theme';
import styles from './styles.module.css';

import IconMdiCheckCircle from '~icons/mdi/check-circle';
import IconMdiClose from '~icons/mdi/close';
import IconMdiAlertCircle from '~icons/mdi/alert-circle';
import IconMdiAlert from '~icons/mdi/alert';

export const Toast = ({ close, title, description, type, delay }: IToastProps) => {
  const handleClose = React.useRef(close);
  handleClose.current = close;

  const {
    activeTheme: { toast: colors },
  } = useThemeContext();

  const typeConfig: { [key in ToastType]: ITypeConfig } = {
    success: {
      icon: () => <IconMdiCheckCircle width={18} height={18} />,
      background: colors.success.backgroundColor,
      color: colors.success.color,
    },
    warn: {
      icon: () => <IconMdiAlert width={18} height={18} />,
      background: colors.warn.backgroundColor,
      color: colors.warn.color,
    },
    error: {
      icon: () => <IconMdiAlertCircle width={18} height={18} />,
      background: colors.error.backgroundColor,
      color: colors.error.color,
    },
  };

  const config = typeConfig[type];

  React.useEffect(() => {
    if (!delay) return;

    const id = setTimeout(() => handleClose.current(), delay);
    return () => clearTimeout(id);
  }, [delay]);

  if (!config) return null;

  const { icon: Icon, background, color } = config;
  const style = { '--toast-background': background, '--toast-color': color } as React.CSSProperties;

  return (
    <div className={styles.container} style={style}>
      <div className={styles.titleContainer}>
        {!!Icon && <Icon />}

        <div className={styles.title}>{title}</div>
      </div>

      {!!description && <div className={styles.description}>{description}</div>}

      <button type="button" onClick={close} className={styles.closeBtn}>
        <IconMdiClose color="white" width={14} height={14} />
      </button>
    </div>
  );
};

export interface IToastProps {
  type: ToastType;
  title: string;
  description: string;
  delay: number;
  close(): void;
}

export type ToastType = 'error' | 'warn' | 'success';

interface ITypeConfig {
  icon: () => JSX.Element;
  background: string;
  color: string;
}
