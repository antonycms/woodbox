import React from 'react';
import styles from './styles.module.css';

export const Row = ({ children }: IRowProps) => {
  return <div className={styles.row}>{children}</div>;
};

export interface IRowProps {
  children?: React.ReactNode;
}
