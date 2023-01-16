import React from 'react';
import clsx from 'clsx';
import styles from './styles.module.css';
import { Column, IGridSystem } from '@renderer/components/Grid';
import theme, { IColors } from '@renderer/styles/theme2';

export const TextCp = (props: ITextProps) => {
  const {
    children,
    className,
    bold,
    color = 'white',
    small,
    title,
    userSelect = true,
    ...gridProps
  } = props;

  const classes = clsx(
    className,
    styles.text,
    bold && styles.bold,
    small && styles.small,
    !userSelect && styles.removeUserSelect,
  );

  return (
    <Column {...gridProps}>
      <p title={title} className={classes} style={{ color: theme[color] }}>
        {children}
      </p>
    </Column>
  );
};

export const Text = React.memo(TextCp);

export interface ITextProps extends IGridSystem {
  children: React.ReactNode;
  className?: string;
  small?: boolean;
  bold?: boolean;
  color?: keyof IColors;
  title?: string;
  userSelect?: boolean;
}
