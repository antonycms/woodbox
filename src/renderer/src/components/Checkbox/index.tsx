import React from 'react';
import { Column, IGridSystem } from '@renderer/components/Grid';
import { Label } from '@renderer/components/Label';
import { generateHash } from '@renderer/utils/methods';
import { classes } from '@renderer/styles/theme';
import styles from './styles.module.css';

interface ICheckboxProps extends IGridSystem {
  id?: string;
  label?: string;
  required?: boolean;
  checked?: boolean;
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
      <div className={classes(required && styles.isRequired)}>
        {!!label && (
          <Label htmlFor={id} color={labelColor}>
            {label}
          </Label>
        )}
        <input style={{ backgroundColor, color }} checked={checked} type="checkbox" onChange={handleChecked} />
      </div>
    </Column>
  );
};
