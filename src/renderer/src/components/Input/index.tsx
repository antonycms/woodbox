import React from 'react';
import { generateHash } from '@renderer/utils/string';
import { Column, IGridSystem } from '@renderer/components/Grid';
import { Label } from '@renderer/components/Label';
import { useThemeContext } from '@renderer/contexts/Theme';
import { classes, toCssProperties } from '@renderer/styles/theme/utils';
import styles from './styles.module.css';

const fakeHandle = () => {};

export const Input = (props: IInputProps) => {
  const {
    ref,
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
    disabled,
    autoFocus,
    useFakeInputToValidate,
    children,
    idContainer,
    onKeyDown,
    onKeyUp,
    onClick,
    onFocus,
    onBlur,
    style,
    accept,
    'data-value': dataValue,
    icon: Icon,
    id: externalId,
    ...gridSystem
  } = props;
  const {
    activeTheme: { __colors },
  } = useThemeContext();

  const id = React.useMemo(() => externalId || generateHash(), [externalId]);
  const inputTitle = title ? title : !label && placeholder ? placeholder : undefined;
  const wrapperStyle = React.useMemo(
    () =>
      ({
        '--input-required-color': __colors.red,
      } as React.CSSProperties),
    [__colors.red],
  );

  const inputContainerStyle = React.useMemo(() => ({ backgroundColor }), [backgroundColor]);

  const inputStyle = React.useMemo(() => {
    return { ...toCssProperties({ placeholderColor }), maxWidth, color };
  }, [color, maxWidth, placeholderColor]);

  return (
    <Column {...gridSystem}>
      <div className={classes(required && styles.isRequired)} style={wrapperStyle}>
        {!!label && (
          <Label color={labelColor || color} htmlFor={id}>
            {label}
          </Label>
        )}

        <div id={idContainer} className={styles.inputContainer} style={inputContainerStyle}>
          {!!useFakeInputToValidate && (
            <input
              tabIndex={-1}
              className={classes(styles.input, styles.hidden)}
              required={required}
              maxLength={maxLength}
              minLength={minLength}
              min={min}
              max={max}
              value={value || dataValue || ''}
              type={type}
              onChange={fakeHandle}
              disabled={disabled}
            />
          )}

          <input
            ref={ref}
            autoFocus={autoFocus}
            disabled={disabled}
            id={id}
            name={name}
            title={inputTitle}
            min={!useFakeInputToValidate ? min : undefined}
            max={!useFakeInputToValidate ? max : undefined}
            maxLength={!useFakeInputToValidate ? maxLength : undefined}
            minLength={!useFakeInputToValidate ? minLength : undefined}
            placeholder={placeholder}
            value={value}
            defaultValue={defaultValue}
            accept={accept}
            data-value={dataValue}
            type={type}
            required={!useFakeInputToValidate ? required : undefined}
            onChange={onChange}
            onKeyDown={onKeyDown}
            onKeyUp={onKeyUp}
            onClick={onClick}
            onFocus={onFocus}
            onBlur={onBlur}
            style={{ ...(style || {}), ...inputStyle }}
            className={classes(className, styles.input, centerText && styles.centerText)}
          />

          {!!Icon && (
            <div className={styles.iconContainer}>
              <Icon />
            </div>
          )}

          {children}
        </div>
      </div>
    </Column>
  );
};

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
  ref?: React.Ref<HTMLInputElement>;
  children?: React.ReactNode;
  disabled?: boolean;
  value?: string | number;
  'data-value'?: any;
  useFakeInputToValidate?: boolean;
  placeholder?: string;
  onChange?(event: React.ChangeEvent<HTMLInputElement>): void;
  min?: string | number;
  max?: string | number;
  maxLength?: number;
  minLength?: number;
  name?: string;
  id?: string;
  idContainer?: string;
  defaultValue?: string;
  maxWidth?: string;
  className?: string;
  type?: InputTypes;
  centerText?: boolean;
  required?: boolean;
  title?: string;
  icon?(): React.ReactElement;
  color: string;
  backgroundColor: string;
  placeholderColor?: string;
  label?: string;
  labelColor?: string;
  autoFocus?: boolean;
  onClick?: React.MouseEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onKeyDown?: React.KeyboardEventHandler<HTMLInputElement>;
  onKeyUp?: React.KeyboardEventHandler<HTMLInputElement>;
  autoComplete?: React.HTMLInputAutoCompleteAttribute;
  spellCheck?: boolean | 'true' | 'false';
  style?: React.CSSProperties;
  accept?: string;
};
