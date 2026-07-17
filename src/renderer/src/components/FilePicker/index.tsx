import React from 'react';
import { generateHash } from '@renderer/utils/string';
import { Column, IGridSystem } from '@renderer/components/Grid';
import { Label } from '@renderer/components/Label';
import { useThemeContext } from '@renderer/contexts/Theme';
import { classes } from '@renderer/styles/theme/utils';
import styles from './styles.module.css';

export const FilePicker = (props: IFilePickerProps) => {
  const {
    ref,
    accept,
    autoFocus,
    backgroundColor,
    buttonText = 'Escolher arquivo',
    className,
    color,
    disabled,
    fileName,
    id: externalId,
    idContainer,
    label,
    labelColor,
    multiple,
    name,
    onBlur,
    onChange,
    onClick,
    onFocus,
    placeholder = 'Nenhum arquivo selecionado',
    placeholderColor,
    required,
    style,
    title,
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
        '--file-picker-required-color': __colors.red,
      } as React.CSSProperties),
    [__colors.red],
  );

  const pickerStyle = React.useMemo(
    () =>
      ({
        '--file-picker-background-color': backgroundColor,
        '--file-picker-color': color,
        '--file-picker-border-color': __colors.lightGray,
        '--file-picker-muted-color': placeholderColor || __colors.gray,
        ...(style || {}),
      } as React.CSSProperties),
    [__colors.gray, __colors.lightGray, backgroundColor, color, placeholderColor, style],
  );

  return (
    <Column {...gridSystem}>
      <div className={classes(required && styles.isRequired)} style={wrapperStyle}>
        {!!label && (
          <Label className={styles.label} color={labelColor || color} htmlFor={id}>
            {label}
          </Label>
        )}

        <label
          id={idContainer}
          className={classes(className, styles.filePicker)}
          style={pickerStyle}
        >
          <input
            ref={ref}
            accept={accept}
            autoFocus={autoFocus}
            disabled={disabled}
            id={id}
            multiple={multiple}
            name={name}
            required={required}
            title={inputTitle}
            type="file"
            onBlur={onBlur}
            onChange={onChange}
            onClick={onClick}
            onFocus={onFocus}
          />

          <span className={styles.button}>{buttonText}</span>
          <span className={styles.name}>{fileName || placeholder}</span>
        </label>
      </div>
    </Column>
  );
};

export type IFilePickerProps = IGridSystem & {
  ref?: React.Ref<HTMLInputElement>;
  accept?: string;
  autoFocus?: boolean;
  backgroundColor: string;
  buttonText?: string;
  className?: string;
  color: string;
  disabled?: boolean;
  fileName?: string;
  id?: string;
  idContainer?: string;
  label?: string;
  labelColor?: string;
  multiple?: boolean;
  name?: string;
  onBlur?: React.FocusEventHandler<HTMLInputElement>;
  onChange?(event: React.ChangeEvent<HTMLInputElement>): void;
  onClick?: React.MouseEventHandler<HTMLInputElement>;
  onFocus?: React.FocusEventHandler<HTMLInputElement>;
  placeholder?: string;
  placeholderColor?: string;
  required?: boolean;
  style?: React.CSSProperties;
  title?: string;
};
