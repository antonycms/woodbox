import React from 'react';
import styles from './styles.module.css';

export const Spacer = React.memo((props: ISpacerProps) => {
  const { flexDirection = 'row', justifyContent = 'center', alignItems = 'center' } = props;

  return (
    <div
      className={styles.spacer}
      style={{
        flexDirection: flexDirection,
        justifyContent: justifyContent,
        alignItems: alignItems,
      }}
    />
  );
});

Spacer.displayName = 'Spacer';

interface ISpacerProps {
  children?: React.ReactNode;
  flexDirection?: 'row' | 'column';
  alignItems?: 'center' | 'flex-start' | 'flex-end';
  justifyContent?:
    | 'center'
    | 'flex-start'
    | 'flex-end'
    | 'space-between'
    | 'space-around'
    | 'space-evenly';
}
