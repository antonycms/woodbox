import clsx from 'clsx';
import React from 'react';
import styles from './styles.module.css';

export const Label = (props: React.LabelHTMLAttributes<HTMLLabelElement>) => {
  return <label {...props} className={clsx(styles.label, props.className)}></label>;
};
