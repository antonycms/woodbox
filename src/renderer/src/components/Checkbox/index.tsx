import React from 'react';
import clsx from 'clsx';
import { Column, IGridSystem } from '@renderer/components/Grid';
import { Label } from '@renderer/components/Label';
import { generateHash } from '@renderer/utils/methods';
import styles from './styles.module.css';

interface ICheckboxProps extends IGridSystem {
  id?: string;
  label?: string;
  required?: boolean;
  checked?: boolean;
  onChecked?(checked: boolean): void;
}

export const Checkbox = (props: ICheckboxProps) => {
  const { label, required, checked, onChecked, id: externalId, ...gridSystem } = props;

  const id = React.useMemo(() => externalId || generateHash(), [externalId]);

  const handleChecked = React.useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => onChecked?.(event.target.checked),
    [onChecked],
  );

  return (
    <Column {...gridSystem}>
      <div className={clsx(required && styles.isRequired)}>
        {!!label && <Label htmlFor={id}>{label}</Label>}
        <input checked={checked} type="checkbox" onChange={handleChecked} />
      </div>
    </Column>
  );
};
