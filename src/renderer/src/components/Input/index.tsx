import React from 'react';
import { generateHash } from '@renderer/utils/methods';
import { Column, IGridSystem } from '@renderer/components/Grid';
import { Label } from '@renderer/components/Label';
import { classes, toCssProperties } from '@renderer/styles/theme/utils';
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
    labelColor,
    color,
    backgroundColor,
    placeholderColor,
    icon: Icon,
    id: externalId,
    ...gridSystem
  } = props;

  const id = React.useMemo(() => externalId || generateHash(), [externalId]);
  const inputTitle = title ? title : !label && placeholder ? placeholder : undefined;

  return (
    <Column {...gridSystem}>
      <div className={classes(required && styles.isRequired)}>
        {!!label && (
          <Label color={labelColor} htmlFor={id}>
            {label}
          </Label>
        )}
        <div className={styles.inputContainer} style={{ backgroundColor }}>
          <input
            id={id}
            name={name}
            title={inputTitle}
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
            className={classes(className, styles.input, centerText && styles.centerText)}
            style={{ ...toCssProperties({ placeholderColor }), maxWidth, color }}
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

export type IInputProps = IGridSystem & {
  value?: string | number;
  placeholder?: string;
  onChange?(event: React.ChangeEvent<HTMLInputElement>): void;
  min?: string | number;
  max?: string | number;
  maxLength?: number;
  minLength?: number;
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
  color: string;
  backgroundColor: string;
  placeholderColor?: string;
  label?: string;
  labelColor?: string;
};
