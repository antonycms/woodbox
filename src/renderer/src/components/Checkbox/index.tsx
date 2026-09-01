import React from 'react';
import { Column, IGridSystem } from '@renderer/components/Grid';
import { Label } from '@renderer/components/Label';
import { generateHash } from '@renderer/utils/string';
import { classes } from '@renderer/styles/theme';
import styles from './styles.module.css';

interface ICheckboxProps extends IGridSystem {
  id?: string;
  label?: string;
  required?: boolean;
  checked?: boolean;
  disabled?: boolean;
  title?: string;
  onChecked?(checked: boolean): void;
  backgroundColor: string;
  color: string;
  labelColor?: string;
}

export const Checkbox = (props: ICheckboxProps) => {
  const {
    label,
    required,
    checked,
    disabled,
    title,
    onChecked,
    backgroundColor,
    color,
    labelColor,
    id: externalId,
    ...gridSystem
  } = props;

  const id = React.useMemo(() => externalId || generateHash(), [externalId]);

  const handleChecked = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onChecked?.(event.target.checked),
    [onChecked],
  );

  return (
    <Column {...gridSystem}>
      <div className={classes(styles.container, required && styles.isRequired)}>
        {!!label && (
          <Label htmlFor={id} color={labelColor}>
            {label}
          </Label>
        )}
        <input
          id={id}
          title={title}
          style={{ backgroundColor, color }}
          checked={checked}
          disabled={disabled}
          type="checkbox"
          onChange={handleChecked}
        />
      </div>
    </Column>
  );
};
