import React from 'react';
import { MdCheckCircle, MdClose, MdOutlineError, MdOutlineWarning } from 'react-icons/md';
import { useThemeContext } from '@renderer/contexts/Theme';
import styles from './styles.module.css';

export const Toast = ({ close, title, description, type, delay }: IToastProps) => {
  const handleClose = React.useRef(close);
  handleClose.current = close;

  const {
    activeTheme: { toast: colors },
  } = useThemeContext();

  const typeConfig: { [key in ToastType]: ITypeConfig } = {
    success: {
      icon: () => <MdCheckCircle size={18} />,
      background: colors.success.backgroundColor,
      color: colors.success.color,
    },
    warn: {
      icon: () => <MdOutlineWarning size={18} />,
      background: colors.warn.backgroundColor,
      color: colors.warn.color,
    },
    error: {
      icon: () => <MdOutlineError size={18} />,
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
        <MdClose color="white" size={14} />
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
