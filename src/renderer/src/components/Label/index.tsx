import clsx from 'clsx';
import React from 'react';
import styles from './styles.module.css';

export const Label = (props: ILabelProps) => {
  const { color, children, ...othersProps } = props;

  return (
    <label {...othersProps} className={clsx(styles.label, props.className)} style={{ color }}>
      {children}
    </label>
  );
};

interface ILabelProps {
  htmlFor?: string;
  id?: string;
  className?: string;
  title?: string;
  color: string;
  children: React.ReactNode;
}
