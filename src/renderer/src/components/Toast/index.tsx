import React from 'react';
import { MdCheckCircle, MdClose, MdOutlineError, MdOutlineWarning } from 'react-icons/md';
import theme from '@renderer/styles/theme2';
import styles from './styles.module.css';

const typeConfig: { [key in ToastType]: ITypeConfig } = {
  success: {
    icon: () => <MdCheckCircle size={18} />,
    background: theme.greenDark,
    color: theme.white,
  },
  warn: {
    icon: () => <MdOutlineWarning size={18} />,
    background: theme.orange2,
    color: theme.white,
  },
  error: {
    icon: () => <MdOutlineError size={18} />,
    background: theme.red2,
    color: theme.white,
  },
};

export const Toast = ({ close, title, description, type, delay }: IToastProps) => {
  const handleClose = React.useRef(close);
  handleClose.current = close;

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
