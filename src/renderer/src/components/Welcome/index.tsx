import { useThemeContext } from '@renderer/contexts/Theme';
import React from 'react';
import styles from './styles.module.css';

export const Welcolme = () => {
  const {
    activeTheme: { welcome: colors },
  } = useThemeContext();

  return <div className={styles.container} style={colors}></div>;
};
