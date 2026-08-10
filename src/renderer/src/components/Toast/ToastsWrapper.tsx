import React from 'react';
import styles from './styles.module.css';

export const ToastsWrapper = ({ children }) => {
  const hasChildren = React.Children.toArray(children).length;

  if (!hasChildren) return null;
  
  return <div className={styles.toastsWrapper}>{children}</div>;
};
