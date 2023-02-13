import React from 'react';
import styles from './styles.module.css';

export interface IDividerProps {
  /**
   * @default 1
   */
  size?: number;
  color?: string;
}

export const Divider = React.memo((props: IDividerProps) => {
  const { color = 'transparent', size = 1 } = props;
  const height = `${size}px`;

  return (
    <div
      className={styles.divider}
      style={{
        height,
        maxHeight: height,
        backgroundColor: color,
      }}
    />
  );
});

Divider.displayName = 'Divider';
