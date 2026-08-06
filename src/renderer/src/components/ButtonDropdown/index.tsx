import React from 'react';
import { Button, IButtonProps } from '@renderer/components/Button';
import { useThemeContext } from '@renderer/contexts/Theme';
import styles from './styles.module.css';

export interface IButtonDropdownOption {
  id: string;
  label: string;
}

export interface IButtonDropdownProps extends Omit<IButtonProps, 'onClick'> {
  options: IButtonDropdownOption[];
  onSelect?(option: IButtonDropdownOption): void;
  direction?: 'up' | 'down';
  align?: 'left' | 'right';
  dropdownBackground?: string;
  dropdownColor?: string;
  dropdownHoverBackground?: string;
}

export const ButtonDropdown = React.memo((props: IButtonDropdownProps) => {
  const {
    options,
    onSelect,
    direction = 'down',
    align = 'left',
    dropdownBackground = props.backgroundColor,
    dropdownColor = props.color,
    dropdownHoverBackground,
    ...buttonProps
  } = props;
  const {
    activeTheme: { __colors },
  } = useThemeContext();
  const [open, setOpen] = React.useState(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const handleOptionClick = (option: IButtonDropdownOption) => {
    onSelect?.(option);
    setOpen(false);
  };

  React.useEffect(() => {
    if (!open) return;

    const handleClick = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) {
        setOpen(false);
      }
    };

    window.addEventListener('mousedown', handleClick);
    return () => window.removeEventListener('mousedown', handleClick);
  }, [open]);

  return (
    <div ref={containerRef} className={styles.container}>
      <Button {...buttonProps} onClick={() => setOpen((prev) => !prev)} />
      {open && (
        <div
          className={`${styles.dropdown} ${direction === 'up' ? styles.up : styles.down} ${
            align === 'right' ? styles.right : styles.left
          }`}
          style={
            {
              backgroundColor: dropdownBackground,
              '--dropdown-option-hover-background-color':
                dropdownHoverBackground || __colors.darkLightDeep,
            } as React.CSSProperties
          }
        >
          {options.map((option) => (
            <button
              key={option.id}
              className={styles.option}
              onClick={() => handleOptionClick(option)}
              style={{ color: dropdownColor }}
            >
              {option.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
});

ButtonDropdown.displayName = 'ButtonDropdown';
