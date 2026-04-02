import React from 'react';
import { Column } from '@renderer/components/Grid';
import { generateHash } from '@renderer/utils/string';
import { Label } from '@renderer/components/Label';
import { MdKeyboardArrowDown } from 'react-icons/md';
import { classes, toCssProperties } from '@renderer/styles/theme';
import styles from './styles.module.css';

export const Autocomplete = (props) => {
  const {
    required,
    labelColor,
    label,
    name,
    value,
    onChange,
    defaultValue,
    placeholderColor,
    maxWidth,
    color,
    backgroundColor,
    title,
    placeholder,
    className,
    id: externalId,
    ...gridSystem
  } = props;

  const inputTitle = title ? title : !label && placeholder ? placeholder : undefined;

  const id = React.useMemo(() => externalId || generateHash(), [externalId]);

  const inputContainerStyle = React.useMemo(() => ({ backgroundColor }), [backgroundColor]);

  const inputStyle = React.useMemo(() => {
    return { ...toCssProperties({ placeholderColor }), maxWidth, color };
  }, []);

  return (
    <Column {...gridSystem}>
      <div className={classes(styles.container, required && styles.isRequired)}>
        {!!label && (
          <Label color={labelColor} htmlFor={id}>
            {label}
          </Label>
        )}

        <div className={styles.inputContainer} style={inputContainerStyle}>
          <input
            id={id}
            name={name}
            title={inputTitle}
            placeholder={placeholder}
            value={value}
            defaultValue={defaultValue}
            required={required}
            onChange={onChange}
            style={inputStyle}
            className={classes(className, styles.input)}
          />

          <div className={styles.iconContainer}>
            <MdKeyboardArrowDown className={styles.icon} />
          </div>
        </div>
      </div>
    </Column>
  );
};
