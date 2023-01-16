import React from 'react';
import styles from './styles.module.css';

export interface IContainerAppProps {
  children?: React.ReactNode;
}

export const ContainerApp = ({ children }: IContainerAppProps) => {
  return <div className={styles.container}>{children}</div>;
};
