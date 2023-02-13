import React from 'react';
import styles from './styles.module.css';
import clsx from 'clsx';
import { toCssProperties } from '@renderer/styles/theme';

export interface IPropsSpinner {
  color: string;
  size?: number;
  absolute?: boolean;
  thickness?: number;
  background?: string;
}

const SpinnerLoading = (props: IPropsSpinner) => {
  const {
    absolute,
    color,
    size = 60,
    thickness = 3,
    background: backgroundColor = 'rgba(0, 0, 0, 0.1)',
  } = props;

  return (
    <div
      className={clsx(styles.container, absolute && styles.absolute)}
      style={{ backgroundColor }}
    >
      <div
        className={styles.loader}
        style={toCssProperties({ color, size: `${size}px`, thickness: `${thickness}px` })}
      />
    </div>
  );
};

export default SpinnerLoading;
