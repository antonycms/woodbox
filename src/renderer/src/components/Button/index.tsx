import React from 'react';
import clsx from 'clsx';
import { Column, IGridSystem } from '@renderer/components/Grid';
import theme, { IColors } from '@renderer/styles/theme2';
import styles from './styles.module.css';
import { SpinnerLoading } from '../Loaders';

export const Button = React.memo((props: IButtonProps) => {
  const {
    children,
    title,
    alignContent,
    backgroundColor,
    color,
    className,
    text,
    width,
    smallIcon,
    onClick,
    onDoubleClick,
    form,
    type = 'button',
    icon: Icon,
    loading,
    disabled,
    ...gridProps
  } = props;

  const isDisabled = !!(loading || disabled);

  return (
    <Column {...gridProps}>
      <button
        title={title}
        type={type}
        onClick={onClick}
        form={form}
        disabled={isDisabled}
        onDoubleClick={onDoubleClick}
        className={clsx(
          styles.button,
          className,
          text && styles.text,
          smallIcon && styles.smallIcon,
        )}
        style={{
          width,
          justifyContent: alignContent,
          backgroundColor: backgroundColor ? theme[backgroundColor] : undefined,
          color: color ? theme[color] : undefined,
        }}
      >
        {!loading && (
          <>
            {children}

            {!!Icon && (
              <>
                {!!children && <div className={styles.separatorButton} />}
                <Icon />
              </>
            )}
          </>
        )}

        {!!loading && <SpinnerLoading background="transparent" size={14} color={color} />}
      </button>
    </Column>
  );
});

Button.displayName = 'Button';

export interface IButtonProps extends IGridSystem {
  children?: React.ReactNode;
  type?: 'button' | 'submit' | 'reset';
  icon?: () => JSX.Element;
  onClick?: React.MouseEventHandler<HTMLButtonElement>;
  onDoubleClick?: React.MouseEventHandler<HTMLButtonElement>;
  title?: string;
  className?: string;
  text?: boolean;
  backgroundColor?: keyof IColors;
  color?: keyof IColors;
  smallIcon?: boolean;
  width?: string | number;
  alignContent?: 'center' | 'start';
  form?: string;
  disabled?: boolean;
  loading?: boolean;
}
