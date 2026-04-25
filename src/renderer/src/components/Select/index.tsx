import React from 'react';
import { generateHash } from '@renderer/utils/string';
import { Column, IGridSystem } from '@renderer/components/Grid';
import { Label } from '@renderer/components/Label';
import { classes, toCssProperties } from '@renderer/styles/theme';
import styles from './styles.module.css';

import IconMdiKeyboardArrowDown from '~icons/mdi/keyboard-arrow-down';

export const Select = React.memo((props: ISelectProps) => {
  const {
    id: externalId,
    name,
    value,
    onChange,
    defaultValue,
    label,
    items = [],
    required,
    labelColor,
    color: selectColor,
    backgroundColor: selectBackgroundColor,
    extractItemInfo = (item) => ({ key: item, text: item, value: item }),
    ...gridSystem
  } = props;

  const id = React.useMemo(() => externalId || generateHash(), [externalId]);

  const styleVars = toCssProperties({ selectColor, selectBackgroundColor });

  const itemsSerialized = React.useMemo(() => {
    const optGroupsItems = {};
    const itemsWithoutOptGroups = [];

    items.forEach((item) => {
      const { key: optionKey, text: optionText, value: optionValue } = extractItemInfo(item);
      const optGroup = item.optgroup;

      const OptionComponent = (
        <option key={optionKey} value={optionValue}>
          {optionText}
        </option>
      );

      if (!optGroup) {
        itemsWithoutOptGroups.push(OptionComponent);
        return;
      }

      const groupItems = optGroupsItems[optGroup] || [];
      optGroupsItems[optGroup] = [...groupItems, OptionComponent];
    });

    const optGroups = Object.keys(optGroupsItems).map((group) => (
      <optgroup key={`group_${group}`} label={group}>
        {optGroupsItems[group]}
      </optgroup>
    ));

    return (
      <>
        {itemsWithoutOptGroups}
        {optGroups}
      </>
    );
  }, [items, extractItemInfo]);

  return (
    <Column {...gridSystem}>
      <div style={styleVars} className={classes(styles.container, required && styles.isRequired)}>
        {!!label && (
          <Label color={labelColor} htmlFor={id}>
            {label}
          </Label>
        )}

        <select
          className={styles.select}
          id={id}
          name={name}
          value={value}
          onChange={onChange}
          defaultValue={defaultValue}
          required={required}
        >
          {itemsSerialized}
        </select>

        <IconMdiKeyboardArrowDown className={styles.icon} />
      </div>
    </Column>
  );
});

Select.displayName = 'Select';

interface IItemInfo {
  key: string | number;
  value: string | number;
  text: string | number;
}

interface ISelectProps extends IGridSystem {
  id?: string;
  name?: string;
  label?: string;
  value?: string | number;
  defaultValue?: string | number;
  required?: boolean;
  onChange?(e: React.ChangeEvent<HTMLSelectElement>): void;
  backgroundColor: string;
  color: string;
  labelColor?: string;

  items: any[];
  extractItemInfo?(item): IItemInfo;
}
