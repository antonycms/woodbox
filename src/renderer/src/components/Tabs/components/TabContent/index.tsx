import React from 'react';
import { Freeze } from 'react-freeze';
import { classes } from '@renderer/styles/theme';
import styles from '../../styles.module.css';

const TabContent = (props: ITabWindowProps) => {
  const { children, activeTabId, idTab, backgroundColor, hasPadding } = props;
  const isActiveTab = activeTabId === idTab;

  return (
    <div
      className={classes(styles.tabContent, isActiveTab && styles.active)}
      style={{ backgroundColor, padding: hasPadding ? '10px' : null }}
    >
      <Freeze freeze={!isActiveTab}>{children}</Freeze>
    </div>
  );
};

export default TabContent;

export interface ITabWindowProps {
  idTab: string;
  activeTabId?: string | null;
  children?: React.ReactNode;
  backgroundColor?: string;
  hasPadding?: boolean;
}
