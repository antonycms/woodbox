import React from 'react';
import { useThemeStore } from '@renderer/stores/Theme';
import { classes, toCssProperties } from '@renderer/styles/theme';
import styles from '../../styles.module.css';

interface ISidebarActiveContentProps {
  children: React.ReactNode;
  active?: boolean;
}

export const SidebarActiveContent = React.memo((props: ISidebarActiveContentProps) => {
  const { children, active } = props;
  const { sideBar: colors } = useThemeStore((state) => state.activeTheme);

  const stylesVar = toCssProperties({ backgroundColorSidebar: colors.backgroundColor });

  return (
    <div style={stylesVar} className={classes(styles.menuContainer, active && styles.active)}>
      {children}
    </div>
  );
});

SidebarActiveContent.displayName = 'SidebarActiveContent';
