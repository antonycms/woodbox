import React from 'react';
import { useThemeStore } from '@renderer/stores/Theme';
import styles from './styles.module.css';

interface IFilterBarProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

const FilterBar = ({ placeholder, value, onChange }: IFilterBarProps) => {
  const {
    tableInfo: { properties: theme },
  } = useThemeStore((state) => state.activeTheme);

  return (
    <div
      className={styles.filterBar}
      style={{
        backgroundColor: theme.bar.backgroundColor,
        borderColor: theme.bar.borderColor,
      }}
    >
      <input
        className={styles.filterInput}
        placeholder={placeholder}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        style={{ color: theme.bar.color }}
        spellCheck={false}
      />
    </div>
  );
};

export default FilterBar;
