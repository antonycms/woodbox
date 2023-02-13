import clsx from 'clsx';
import React from 'react';
import styles from './styles.module.css';

export interface IBarProps {
  children?: React.ReactNode;
  backgroundColor: string;
  vertical?: boolean;
}

export const Bar = (props: IBarProps) => {
  const { children, backgroundColor, vertical } = props;

  return (
    <div className={clsx(styles.bar, vertical && styles.vertical)} style={{ backgroundColor }}>
      {children}
    </div>
  );
};
