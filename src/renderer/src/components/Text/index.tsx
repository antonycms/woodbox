import React from 'react';
import { Column, IGridSystem } from '@renderer/components/Grid';
import { classes } from '@renderer/styles/theme';
import styles from './styles.module.css';

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

  const classesText = classes(
    className,
    styles.text,
    bold && styles.bold,
    small && styles.small,
    !userSelect && styles.removeUserSelect,
  );

  return (
    <Column {...gridProps}>
      <p title={title} className={classesText} style={{ color }}>
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
  color: string;
  title?: string;
  userSelect?: boolean;
}
