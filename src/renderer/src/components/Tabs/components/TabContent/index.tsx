import React from 'react';
import { classes } from '@renderer/styles/theme';
import styles from '../../styles.module.css';
import { useTabContext } from '../TabProvider';

const TabContent = (props: ITabWindowProps) => {
  const { children, idTab, backgroundColor, hasPadding } = props;
  const { activeTabId } = useTabContext();

  return (
    <div
      className={classes(styles.tabContent, activeTabId === idTab && styles.active)}
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
