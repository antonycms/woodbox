import React from 'react';
import theme, { IColors } from '@renderer/styles/theme2';
import styles from './styles.module.css';

export interface IDividerProps {
  /**
   * @default 1
   */
  size?: number;
  color?: keyof IColors;
}

export const Divider = React.memo((props: IDividerProps) => {
  const { color = 'darkLight2', size = 1 } = props;
  const height = `${size}px`;

  return (
    <div
      className={styles.divider}
      style={{
        height,
        maxHeight: height,
        backgroundColor: theme[color],
      }}
    />
  );
});

Divider.displayName = 'Divider';
