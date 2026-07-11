import React from 'react';
import { Freeze } from 'react-freeze';
import { classes } from '@renderer/styles/theme';
import styles from '../../styles.module.css';
import { useTabContext } from '../TabProvider';
import TabContentProvider from '../TabContentProvider';

const TabContent = (props: ITabWindowProps) => {
  const { children, idTab, backgroundColor, hasPadding } = props;
  const { activeTabId } = useTabContext();
  const isActiveTab = activeTabId === idTab;

  return (
    <div
      className={classes(styles.tabContent, isActiveTab && styles.active)}
      style={{ backgroundColor, padding: hasPadding ? '10px' : null }}
    >
      <TabContentProvider activeTabId={activeTabId} tabId={idTab}>
        <Freeze freeze={!isActiveTab}>{children}</Freeze>
      </TabContentProvider>
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
