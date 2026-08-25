import React from 'react';
import { useThemeContext } from '@renderer/contexts/Theme';
import styles from './styles.module.css';

interface IFilterBarProps {
  placeholder: string;
  value: string;
  onChange: (value: string) => void;
}

const FilterBar = ({ placeholder, value, onChange }: IFilterBarProps) => {
  const {
    activeTheme: {
      tableInfo: { properties: theme },
    },
  } = useThemeContext();

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
