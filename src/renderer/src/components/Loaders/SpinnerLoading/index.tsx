import React from 'react';
import theme, { IColors } from '@renderer/styles/theme2';
import styles from './styles.module.css';
import clsx from 'clsx';

export interface IPropsSpinner {
  color?: keyof IColors;
  size?: number;
  absolute?: boolean;
  thickness?: number;
  background?: keyof IColors;
}

const SpinnerLoading = (props: IPropsSpinner) => {
  const { absolute, background, color = 'purple', size = 60, thickness = 3 } = props;

  return (
    <div
      className={clsx(styles.container, absolute && styles.absolute)}
      style={{ backgroundColor: background || 'rgba(0, 0, 0, 0.1)' }}
    >
      <div
        className={styles.loader}
        style={
          {
            '--color': theme[color],
            '--size': `${size}px`,
            '--thickness': `${thickness}px`,
          } as React.CSSProperties
        }
      />
    </div>
  );
};

export default SpinnerLoading;
