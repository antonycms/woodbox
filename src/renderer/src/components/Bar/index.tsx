import React from 'react';
import { classes, toCssProperties } from '@renderer/styles/theme';
import styles from './styles.module.css';

export interface IBarProps {
  children?: React.ReactNode;
  backgroundColor: string;
  borderColor?: string;
  vertical?: boolean;
}

export const Bar = (props: IBarProps) => {
  const { children, backgroundColor, borderColor, vertical } = props;

  return (
    <div
      className={classes(styles.bar, vertical && styles.vertical)}
      style={{ ...toCssProperties({ borderColor }), backgroundColor }}
    >
      {children}
    </div>
  );
};
