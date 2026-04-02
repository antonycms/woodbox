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

  const style = React.useMemo(() => {
    return { height, maxHeight: height, backgroundColor: color };
  }, [height, color]);

  return <div className={styles.divider} style={style} />;
});

Divider.displayName = 'Divider';
