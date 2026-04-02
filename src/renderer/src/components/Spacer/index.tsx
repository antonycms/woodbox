import React from 'react';
import styles from './styles.module.css';

export const Spacer = React.memo((props: ISpacerProps) => {
  const { flexDirection = 'row', justifyContent = 'center', alignItems = 'center' } = props;

  const style = React.useMemo(() => {
    return { flexDirection, justifyContent, alignItems };
  }, [flexDirection, justifyContent, alignItems]);

  return <div className={styles.spacer} style={style} />;
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
