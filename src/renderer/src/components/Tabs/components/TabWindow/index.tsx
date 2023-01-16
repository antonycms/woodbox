import React from 'react';
import styles from '../../styles.module.css';

const TabWindow = ({ children, idTabBar, width, height }: ITabWindowProps) => {
  return (
    <div className={styles.tabWindow} id={`tab_window_${idTabBar}`} style={{ width, height }}>
      {children}
    </div>
  );
};

export default TabWindow;

export interface ITabWindowProps {
  idTabBar: string;
  children?: React.ReactNode;
  width?: string;
  height?: string;
}
