import React from 'react';
import { classes } from '@renderer/styles/theme';
import { FaDatabase, FaFolder } from 'react-icons/fa';
import {
  MdFunctions,
  MdGridView,
  MdKeyboardArrowDown,
  MdKeyboardArrowRight,
  MdOutlineSchema,
} from 'react-icons/md';
import { FaFolderTree } from 'react-icons/fa6';
import { BsFiletypeSql, BsFileEarmarkText } from 'react-icons/bs';
import { TbBoxMultipleFilled } from 'react-icons/tb';
import { PiFunctionLight } from 'react-icons/pi';
import { AiOutlineTable } from 'react-icons/ai';
import styles from './styles.module.css';

const availableIcons = {
  default: FaFolder,
  folder: FaFolder,
  file: BsFileEarmarkText,
  database: FaDatabase,
  table: AiOutlineTable,
  arrowDown: MdKeyboardArrowDown,
  arrowRight: MdKeyboardArrowRight,
  schema: MdOutlineSchema,
  fileSql: BsFiletypeSql,
  grid: MdGridView,
  folderTree: FaFolderTree,
  functions: MdFunctions,
  multi: TbBoxMultipleFilled,
  function: PiFunctionLight,
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
