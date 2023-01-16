import React from 'react';
import styles from '../../styles.module.css';

const TabContent = (props: ITabWindowProps) => {
  const { children, idTab } = props;

  return (
    <div className={styles.tabContent} id={`tab_content_${idTab}`}>
      {children}
    </div>
  );
};

export default TabContent;

export interface ITabWindowProps {
  idTab: string;
  children?: React.ReactNode;
}
