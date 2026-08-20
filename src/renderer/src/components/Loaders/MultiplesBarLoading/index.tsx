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
    activeTheme: { loaders: theme },
  } = useThemeContext();
  const { background = theme.overlayBackgroundColor, zIndex } = props;

  return (
    <div
      style={{
        background,
        zIndex,
        ...toCssProperties({
          barColor1: theme.barColors[0],
          barColor2: theme.barColors[1],
          barColor3: theme.barColors[2],
          barColor4: theme.barColors[3],
          barColor5: theme.barColors[4],
          barColor6: theme.barColors[5],
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
