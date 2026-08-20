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
  const [isHovered, setIsHovered] = React.useState(false);
  const [remainingTime, setRemainingTime] = React.useState(delay);

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

    setRemainingTime(delay);
  }, [delay]);

  React.useEffect(() => {
    if (!delay || isHovered) return;

    if (remainingTime <= 0) {
      handleClose.current();
      return;
    }

    const startedAt = Date.now();
    const id = setTimeout(() => {
      const elapsedTime = Date.now() - startedAt;

      setRemainingTime((currentRemainingTime) => Math.max(currentRemainingTime - elapsedTime, 0));
    }, 50);

    return () => clearTimeout(id);
  }, [delay, isHovered, remainingTime]);

  if (!config) return null;

  const { icon: Icon, background, color } = config;
  const progress = delay ? Math.max((remainingTime / delay) * 100, 0) : 0;
  const style = {
    '--toast-background': background,
    '--toast-color': color,
    '--toast-progress': `${progress}%`,
    '--toast-shadow-color': colors.shadowColor,
    '--toast-icon-background': colors.iconBackgroundColor,
  } as React.CSSProperties;

  return (
    <div
      className={styles.container}
      style={style}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      <div className={styles.titleContainer}>
        {!!Icon && (
          <div className={styles.iconContainer}>
            <Icon />
          </div>
        )}

        <div className={styles.title}>{title}</div>
      </div>

      {!!description && <div className={styles.description}>{description}</div>}

      <button type="button" onClick={close} className={styles.closeBtn}>
        <IconMdiClose width={14} height={14} />
      </button>

      {!!delay && <div className={styles.progressBar} />}
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
  icon: () => React.ReactElement;
  background: string;
  color: string;
}
