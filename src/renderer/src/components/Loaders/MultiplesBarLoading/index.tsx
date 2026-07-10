import React from 'react';
import styles from './styles.module.css';

interface IMultiplesBarLoadingProps {
  background?: string;
  zIndex?: number;
}
const MultiplesBarLoading = (props: IMultiplesBarLoadingProps) => {
  const { background = 'rgba(0, 0, 0, 0.5)', zIndex } = props;

  return (
    <div style={{ background, zIndex }} className={styles.container}>
      <div className={styles.loader}>
        <div className={styles.bar1}></div>
        <div className={styles.bar2}></div>
        <div className={styles.bar3}></div>
        <div className={styles.bar4}></div>
        <div className={styles.bar5}></div>
        <div className={styles.bar6}></div>
      </div>
    </div>
  );
};

export default MultiplesBarLoading;
