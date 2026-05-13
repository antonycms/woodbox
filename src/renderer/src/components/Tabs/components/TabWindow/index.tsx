import React from 'react';
import styles from '../../styles.module.css';
import TabProvider from '../TabProvider';

const TabWindow = ({ children, idTabBar, width, height }: ITabWindowProps) => {
  return (
    <TabProvider>
      <div className={styles.tabWindow} id={`tab_window_${idTabBar}`} style={{ width, height }}>
        {children}
      </div>
    </TabProvider>
  );
};

export default TabWindow;

export interface ITabWindowProps {
  idTabBar: string;
  children?: React.ReactNode;
  width?: string;
  height?: string;
}
