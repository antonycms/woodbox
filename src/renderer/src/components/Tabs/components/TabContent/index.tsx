import React from 'react';
import styles from '../../styles.module.css';

const TabContent = (props: ITabWindowProps) => {
  const { children, idTab, backgroundColor, hasPadding } = props;

  return (
    <div
      className={styles.tabContent}
      id={`tab_content_${idTab}`}
      style={{ backgroundColor, padding: hasPadding ? '10px' : null }}
    >
      {children}
    </div>
  );
};

export default TabContent;

export interface ITabWindowProps {
  idTab: string;
  children?: React.ReactNode;
  backgroundColor?: string;
  hasPadding?: boolean;
}
