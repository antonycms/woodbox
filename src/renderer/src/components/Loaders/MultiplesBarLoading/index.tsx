import React from 'react';
import { useThemeContext } from '@renderer/contexts/Theme';
import { toCssProperties } from '@renderer/styles/theme';
import styles from './styles.module.css';

interface IMultiplesBarLoadingProps {
  background?: string;
  zIndex?: number;
}
const MultiplesBarLoading = (props: IMultiplesBarLoadingProps) => {
  const {
    activeTheme: { __colors },
  } = useThemeContext();
  const { background = __colors.overlay, zIndex } = props;

  return (
    <div
      style={{
        background,
        zIndex,
        ...toCssProperties({
          barColor1: __colors.purple,
          barColor2: __colors.blue,
          barColor3: __colors.green,
          barColor4: __colors.orange,
          barColor5: __colors.orangeDeep,
          barColor6: __colors.pink,
        }),
      }}
      className={styles.container}
    >
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
