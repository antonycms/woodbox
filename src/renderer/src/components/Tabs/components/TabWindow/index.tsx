import React from 'react';
import styles from '../../styles.module.css';
import TabProvider from '../TabProvider';

const TabWindow = ({ children, activeTabId, width, height }: ITabWindowProps) => {
  return (
    <TabProvider activeTabId={activeTabId}>
      <div className={styles.tabWindow} style={{ width, height }}>
        {children}
      </div>
    </TabProvider>
  );
};

export default TabWindow;

export interface ITabWindowProps {
  activeTabId: string | null;
  children?: React.ReactNode;
  width?: string;
  height?: string;
}
