import React from 'react';
import styles from './styles.module.css';

export interface IBarProps {
  children?: React.ReactNode;
}

export const Bar = ({ children }: IBarProps) => {
  return <div className={styles.bar}>{children}</div>;
};
