import React from 'react';
import { useThemeContext } from '@renderer/contexts/Theme';
import { classes, toCssProperties } from '@renderer/styles/theme';
import styles from './styles.module.css';

export const MenuBar = ({
  onChange,
  value,
  items,
  footerItems,
  onFooterItemClick,
}: IMenuBarProps) => {
  const { activeTheme } = useThemeContext();

  const {
    ascentColor: ascentColorMenuBar,
    backgroundColor: backgroundColorMenuBar,
    color: colorMenuBar,
  } = activeTheme.sideBar.menuBar;

  const stylesVar = toCssProperties({ ascentColorMenuBar, backgroundColorMenuBar, colorMenuBar });

  return (
    <div className={styles.categoryBar} style={stylesVar}>
      {items.map((item) => (
        <button
          key={item.id}
          title={item.title}
          onClick={() => onChange?.(item.id)}
          className={classes(styles.categoryBarButton, item.id === value && styles.active)}
        >
          <item.icon />
        </button>
      ))}

      {!!footerItems?.length && (
        <div className={styles.footer}>
          {footerItems.map((item) => (
            <button
              key={item.id}
              title={item.title}
              onClick={() => onFooterItemClick?.(item.id)}
              className={classes(styles.categoryBarButton, item.id === value && styles.active)}
            >
              <item.icon />
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export interface IItemBar {
  id: string;
  title?: string;
  icon(): React.ReactElement;
}

export interface IMenuBarProps {
  /**
   * @default true
   */
  automaticSelectFirst?: boolean;
  items: IItemBar[];
  footerItems?: IItemBar[];
  value?: string;
  onChange?: (idItem: string) => void;
  onFooterItemClick?: (idItem: string) => void;
}
