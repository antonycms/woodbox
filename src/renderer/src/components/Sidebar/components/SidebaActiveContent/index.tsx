import clsx from 'clsx';
import React from 'react';
import styles from '../../styles.module.css';

interface ISidebarActiveContentProps {
  children: React.ReactNode;
  active?: boolean;
}

export const SidebarActiveContent = React.memo((props: ISidebarActiveContentProps) => {
  const { children, active } = props;

  return <div className={clsx(styles.menuContainer, active && styles.active)}>{children}</div>;
});

SidebarActiveContent.displayName = 'SidebarActiveContent';
