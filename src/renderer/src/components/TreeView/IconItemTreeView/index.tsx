import React from 'react';
import { classes } from '@renderer/styles/theme';
import { FaDatabase, FaFileAlt, FaFolder, FaTable } from 'react-icons/fa';
import { MdKeyboardArrowDown, MdKeyboardArrowRight } from 'react-icons/md';
import styles from './styles.module.css';

const availableIcons = {
  default: FaFolder,
  folder: FaFolder,
  file: FaFileAlt,
  database: FaDatabase,
  table: FaTable,
  arrowDown: MdKeyboardArrowDown,
  arrowRight: MdKeyboardArrowRight,
};

const IconItemTreeView = ({ no_margin, icon = 'folder', ...props }: IIcon) => {
  const Cp = availableIcons[icon] || availableIcons.default;
  const hasClick = !!props.onClick;

  return (
    <Cp
      {...props}
      className={classes(
        styles.icon,
        hasClick && styles.clickable,
        no_margin && styles.no_margin,
        hasClick && 'outline-focus-visible',
      )}
    />
  );
};

export default IconItemTreeView;

export type AvalailableTreeViewIcon = keyof typeof availableIcons;

interface IIcon {
  icon: AvalailableTreeViewIcon;
  color?: string;
  className?: string;
  no_margin?: boolean;
  onClick?(): void;
}
