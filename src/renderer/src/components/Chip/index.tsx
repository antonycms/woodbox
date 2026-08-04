import React from 'react';
import { classes } from '@renderer/styles/theme';
import styles from './styles.module.css';

export const Chip = React.memo((props: IChipProps) => {
  const { children, className, color, backgroundColor, borderColor, style, title } = props;

  const chipStyle = React.useMemo(
    () => ({ color, backgroundColor, borderColor, ...style }),
    [backgroundColor, borderColor, color, style],
  );

  return (
    <span title={title} className={classes(styles.chip, className)} style={chipStyle}>
      {children}
    </span>
  );
});

Chip.displayName = 'Chip';

interface IChipProps {
  children?: React.ReactNode;
  className?: string;
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
  style?: React.CSSProperties;
  title?: string;
}
