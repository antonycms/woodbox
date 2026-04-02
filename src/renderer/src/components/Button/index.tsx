import React from 'react';
import { Column, IGridSystem } from '@renderer/components/Grid';
import { SpinnerLoading } from '@renderer/components/Loaders';
import { classes } from '@renderer/styles/theme';
import styles from './styles.module.css';

export const Button = React.memo((props: IButtonProps) => {
  const {
    children,
    title,
    justifyContent,
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

  const classesButton = classes(
    styles.button,
    className,
    text && styles.text,
    smallIcon && styles.smallIcon,
  );

  const isDisabled = !!(loading || disabled);

  const style = React.useMemo(() => {
    return { color, backgroundColor, width, justifyContent };
  }, [color, backgroundColor, width, justifyContent]);

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
        className={classesButton}
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
  form?: string;
  disabled?: boolean;
  loading?: boolean;

  text?: boolean;
  backgroundColor?: string;
  color?: string;
  smallIcon?: boolean;
  width?: string;
  justifyContent?: 'start' | 'center';
}
