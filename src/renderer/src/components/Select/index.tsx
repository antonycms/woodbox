import { generateHash } from '@renderer/utils/methods';
import React from 'react';
import { MdKeyboardArrowDown } from 'react-icons/md';
import clsx from 'clsx';
import { Column, IGridSystem } from '../Grid';
import { Label } from '../Label';
import styles from './styles.module.css';

export const Select = React.memo(
  ({
    id: externalId,
    name,
    value,
    onChange,
    defaultValue,
    label,
    items = [],
    required,
    extractItemInfo = (item) => ({ key: item, text: item, value: item }),
    ...gridSystem
  }: ISelectProps) => {
    const id = React.useMemo(() => externalId || generateHash(), [externalId]);

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
        <div className={clsx(styles.container, required && styles.isRequired)}>
          {!!label && <Label htmlFor={id}>{label}</Label>}

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

          <MdKeyboardArrowDown className={styles.icon} />
        </div>
      </Column>
    );
  },
);

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

  items: any[];
  extractItemInfo?(item): IItemInfo;
}
