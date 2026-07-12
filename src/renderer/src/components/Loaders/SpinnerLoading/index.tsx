import React from 'react';
import { useThemeContext } from '@renderer/contexts/Theme';
import { classes, toCssProperties } from '@renderer/styles/theme';
import styles from './styles.module.css';

export interface IPropsSpinner {
  color: string;
  size?: number;
  absolute?: boolean;
  thickness?: number;
  background?: string;
  center?: boolean;
  padding?: string;
}

const SpinnerLoading = (props: IPropsSpinner) => {
  const { absolute, color, size = 60, thickness = 3, center, padding = '3px', background } = props;
  const {
    activeTheme: { __colors },
  } = useThemeContext();
  const backgroundColor = background || __colors.darkLight;

  return (
    <div
      className={classes(styles.container, absolute && styles.absolute)}
      style={{ padding, backgroundColor, margin: center ? '0 auto' : 0 }}
    >
      <div
        className={styles.loader}
        style={toCssProperties({ color, size: `${size}px`, thickness: `${thickness}px` })}
      />
    </div>
  );
};

export default SpinnerLoading;
