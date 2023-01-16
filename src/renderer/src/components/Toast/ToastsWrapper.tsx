import React from 'react';
import styles from './styles.module.css';

export const ToastsWrapper = ({ children }) => {
  return <div className={styles.toastsWrapper}>{children}</div>;
};
