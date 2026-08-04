import React from 'react';
import { classes } from '@renderer/styles/theme';
import styles from './styles.module.css';

export const Card = React.memo((props: ICardProps) => {
  const { children, className, color, backgroundColor, borderColor, style, ...divProps } = props;

  const cardStyle = React.useMemo(
    () => ({ color, backgroundColor, borderColor, ...style }),
    [backgroundColor, borderColor, color, style],
  );

  return (
    <div {...divProps} className={classes(styles.card, className)} style={cardStyle}>
      {children}
    </div>
  );
});

Card.displayName = 'Card';

interface ICardProps extends React.HTMLAttributes<HTMLDivElement> {
  color?: string;
  backgroundColor?: string;
  borderColor?: string;
}
