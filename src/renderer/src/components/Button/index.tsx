import React from 'react';
import clsx from 'clsx';
import { Column, IGridSystem } from '@renderer/components/Grid';
import { SpinnerLoading } from '@renderer/components/Loaders';
import styles from './styles.module.css';

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
    loading,
    disabled,
    icon: Icon,
    type = 'button',
    ...gridProps
  } = props;

  const classes = clsx(
    styles.button,
    className,
    text && styles.text,
    smallIcon && styles.smallIcon,
  );

  const isDisabled = !!(loading || disabled);
  const style = { color, backgroundColor, width, justifyContent: alignContent };

  return (
    <Column {...gridProps}>
      <button
        title={title}
        type={type}
        onClick={onClick}
        form={form}
        disabled={isDisabled}
        onDoubleClick={onDoubleClick}
        style={style}
        className={classes}
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
  backgroundColor?: string;
  color?: string;
  smallIcon?: boolean;
  width?: string | number;
  alignContent?: 'center' | 'start';
  form?: string;
  disabled?: boolean;
  loading?: boolean;
}
