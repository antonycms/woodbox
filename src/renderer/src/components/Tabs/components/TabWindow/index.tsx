import React from 'react';
import styles from '../../styles.module.css';

const TabWindow = ({ children, width, height }: ITabWindowProps) => {
  return (
    <div className={styles.tabWindow} style={{ width, height }}>
      {children}
    </div>
  );
};

export default TabWindow;

export interface ITabWindowProps {
  children?: React.ReactNode;
  width?: string;
  height?: string;
}
