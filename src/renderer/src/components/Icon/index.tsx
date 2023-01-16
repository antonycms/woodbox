import React from 'react';

type IconRenderer = (props?: { style: React.CSSProperties }) => JSX.Element;

export interface IElementProps {
  style?: React.CSSProperties;
  size?: number;
}

export interface IIconProps extends IElementProps {
  iconRenderer: IconRenderer;
  fixSize?: number;
}

export const Icon = (props: IIconProps) => {
  const { iconRenderer: IconComponent, size = 20, fixSize = 0, style = {} } = props;
  const serializedSize = `${size - fixSize}px`;

  if (!size || typeof IconComponent !== 'function') return null;

  return <IconComponent style={{ ...style, width: size, fontSize: serializedSize }} />;
};

export const makeIcon = (iconRenderer: IconRenderer, size = 20, fixSize = 0) => {
  const IconComponent = (props: IElementProps) => (
    <Icon
      size={props.size || size}
      fixSize={props.size ? 0 : fixSize}
      iconRenderer={iconRenderer}
      {...props}
    />
  );

  return IconComponent;
};
