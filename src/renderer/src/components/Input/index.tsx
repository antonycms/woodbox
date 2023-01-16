import React from 'react';
import clsx from 'clsx';
import { generateHash } from '@renderer/utils/methods';
import { Column, IGridSystem } from '@renderer/components/Grid';
import { Label } from '@renderer/components/Label';
import styles from './styles.module.css';

export const Input = React.memo((props: IInputProps) => {
  const {
    value,
    defaultValue,
    onChange,
    type,
    placeholder,
    label,
    maxLength,
    minLength,
    name,
    min,
    max,
    maxWidth,
    className,
    centerText,
    title,
    required,
    icon: Icon,
    id: externalId,
    ...gridSystem
  } = props;

  const id = React.useMemo(() => externalId || generateHash(), [externalId]);

  const inputTitle = title ? title : !label && placeholder ? placeholder : undefined;

  return (
    <Column {...gridSystem}>
      <div className={clsx(required && styles.isRequired)}>
        {!!label && <Label htmlFor={id}>{label}</Label>}
        <div className={styles.inputContainer}>
          <input
            id={id}
            name={name}
            min={min}
            max={max}
            maxLength={maxLength}
            minLength={minLength}
            placeholder={placeholder}
            value={value}
            defaultValue={defaultValue}
            type={type}
            required={required}
            onChange={onChange}
            className={clsx(className, styles.input, centerText && styles.centerText)}
            style={{ maxWidth }}
            title={inputTitle}
          />

          {!!Icon && (
            <div className={styles.iconContainer}>
              <Icon />
            </div>
          )}
        </div>
      </div>
    </Column>
  );
});

Input.displayName = 'Input';

export type InputTypes =
  | 'button'
  | 'checkbox'
  | 'color'
  | 'date'
  | 'datetime-local'
  | 'email'
  | 'file'
  | 'hidden'
  | 'image'
  | 'month'
  | 'number'
  | 'password'
  | 'radio'
  | 'range'
  | 'reset'
  | 'search'
  | 'submit'
  | 'tel'
  | 'text'
  | 'time'
  | 'url'
  | 'week';

export interface IInputProps extends IGridSystem {
  value?: string | number;
  placeholder?: string;
  onChange?(event: React.ChangeEvent<HTMLInputElement>): void;
  min?: string | number;
  max?: string | number;
  maxLength?: number;
  minLength?: number;
  label?: string;
  name?: string;
  id?: string;
  defaultValue?: string;
  maxWidth?: string;
  className?: string;
  type?: InputTypes;
  centerText?: boolean;
  required?: boolean;
  title?: string;
  icon?(): JSX.Element;
}
