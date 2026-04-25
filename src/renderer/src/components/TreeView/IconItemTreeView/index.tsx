import React from 'react';
import { classes } from '@renderer/styles/theme';
import styles from './styles.module.css';

import IconMdiKeyboardArrowDown from '~icons/mdi/keyboard-arrow-down';
import IconMdiKeyboardArrowRight from '~icons/mdi/keyboard-arrow-right';
import IconMdiViewGridOutline from '~icons/mdi/view-grid-outline';
import IconMdiFunction from '~icons/mdi/function';
import IconMdiFileTree from '~icons/mdi/file-tree-outline';
import IconMdiSigma from '~icons/mdi/sigma';
import IconFaSolidDatabase from '~icons/fa-solid/database';
import IconFaSolidFolder from '~icons/fa-solid/folder';
import IconFaSolidFolderTree from '~icons/fa6-solid/folder-tree';
import IconBiFiletypeSql from '~icons/bi/filetype-sql';
import IconBiFileEarmarkText from '~icons/bi/file-earmark-text';
import IconTableBoxMultipleFilled from '~icons/tabler/box-multiple-filled';
import IconAntDesign from '~icons/ant-design/table-outlined';

function makeIconWithSize(
  Icon: React.ForwardRefExoticComponent<React.SVGProps<SVGSVGElement>>,
  size: number,
) {
  return (props: React.SVGProps<SVGSVGElement>) => (
    <Icon {...props} width={props?.width || size} height={props?.height || size} />
  );
}

const availableIcons = {
  default: makeIconWithSize(IconFaSolidFolder, 16),
  folder: makeIconWithSize(IconFaSolidFolder, 16),
  file: makeIconWithSize(IconBiFileEarmarkText, 16),
  database: makeIconWithSize(IconFaSolidDatabase, 16),
  table: makeIconWithSize(IconAntDesign, 16),
  arrowDown: makeIconWithSize(IconMdiKeyboardArrowDown, 16),
  arrowRight: makeIconWithSize(IconMdiKeyboardArrowRight, 16),
  schema: makeIconWithSize(IconMdiFileTree, 16),
  fileSql: makeIconWithSize(IconBiFiletypeSql, 16),
  grid: makeIconWithSize(IconMdiViewGridOutline, 16),
  folderTree: makeIconWithSize(IconFaSolidFolderTree, 16),
  functions: makeIconWithSize(IconMdiSigma, 16),
  multi: makeIconWithSize(IconTableBoxMultipleFilled, 16),
  function: makeIconWithSize(IconMdiFunction, 16),
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
