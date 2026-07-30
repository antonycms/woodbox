import React from 'react';
import ReactDOM from 'react-dom';
import { useDropdownFixedPosition } from '@renderer/components/Autocomplete/hooks/useDropdownFixedPosition';
import { useDropdownOutsideClick } from '@renderer/components/Autocomplete/hooks/useDropdownOutsideClick';
import { SpinnerLoading } from '@renderer/components/Loaders';
import { Input } from '@renderer/components/Input';
import { VirtualizeList } from '@renderer/components/VirtualizeList';
import { IGridSystem } from '@renderer/components/Grid';
import { useThemeContext } from '@renderer/contexts/Theme';
import useStateWithDebounce from '@renderer/hooks/useStateWithDebounce';
import { classes, toCssProperties } from '@renderer/styles/theme';
import { generateHash } from '@renderer/utils/string';

import IconMdiKeyboardArrowDown from '~icons/mdi/keyboard-arrow-down';
import IconMdiClose from '~icons/mdi/close';

import styles from './styles.module.css';

const defaultExtractLabel = (item: any) => (typeof item === 'string' ? item : item?.label);
const defaultExtractValue = (item: any) => (typeof item === 'string' ? item : item?.value);

export interface IAutoCompleteMultiRef {
  clear: () => void;
  open: () => void;
}

export function AutocompleteMulti<T = any>(props: IAutocompleteMultiProps<T>) {
  const {
    ref,
    data,
    required,
    labelColor,
    label,
    name,
    value,
    onChange,
    maxWidth,
    color,
    backgroundColor,
    title,
    placeholder,
    className,
    loading,
    id,
    clearable = true,
    extractLabel = defaultExtractLabel,
    extractValue = defaultExtractValue,
    emptyMessage = 'Não há opções disponíveis',
    ...gridSystem
  } = props;
  const {
    activeTheme: { __colors },
  } = useThemeContext();

  const itemSize = 41;

  const refScrollElement = React.useRef<HTMLDivElement>(null);
  const refInput = React.useRef<HTMLInputElement>(null);
  const [idContainer] = React.useState(generateHash(10));
  const idDropdown = `${idContainer}-dropdown`;
  const [isDropdownOpen, setIsDropdownOpen] = React.useState(false);
  const [activeIndex, setActiveIndex] = React.useState(-1);
  const [textInput, setTextInput] = useStateWithDebounce('');

  const extractLabelRef = React.useRef(extractLabel);
  extractLabelRef.current = extractLabel;

  const extractValueRef = React.useRef(extractValue);
  extractValueRef.current = extractValue;

  const dataFiltered = React.useMemo(() => {
    if (!textInput) return [...data.entries()];

    const normalizedTextInput = textInput.toLowerCase();
    const array: [number, T][] = [];
    const labels = new Map<number, string>();

    for (let i = 0; i < data.length; i++) {
      const item = data[i];
      const normalizedLabel = extractLabelRef.current(item).toLowerCase();
      const textContains = normalizedLabel.includes(normalizedTextInput);

      if (textContains) {
        array.push([i, item]);
        labels.set(i, normalizedLabel);
      }
    }

    return array.sort(([indexA], [indexB]) => {
      const itemAStartsWithTextInput = labels.get(indexA).startsWith(normalizedTextInput);
      const itemBStartsWithTextInput = labels.get(indexB).startsWith(normalizedTextInput);

      if (itemAStartsWithTextInput === itemBStartsWithTextInput) return indexA - indexB;

      return itemAStartsWithTextInput ? -1 : 1;
    });
  }, [textInput, data]);

  const selected = React.useMemo(() => {
    if (value === null || value === undefined || !data) return [];

    return data.filter((item) => value?.includes?.(extractValueRef.current(item)));
  }, [value, data]);

  const selectedLabel = selected.length
    ? selected.map((item) => extractLabelRef.current(item)).join(', ')
    : undefined;

  const getNearestSelectedIndex = React.useCallback(
    (currentIndex: number) => {
      if (!selected.length) return -1;

      const selectedValues = new Set(selected.map((item) => extractValueRef.current(item)));
      const selectedIndexes = dataFiltered.reduce<number[]>((indexes, [, item], index) => {
        if (selectedValues.has(extractValueRef.current(item))) indexes.push(index);

        return indexes;
      }, []);

      if (!selectedIndexes.length) return -1;
      if (currentIndex < 0) return selectedIndexes[0];

      return selectedIndexes.reduce((nearestIndex, index) => {
        const nearestDistance = Math.abs(nearestIndex - currentIndex);
        const currentDistance = Math.abs(index - currentIndex);

        return currentDistance < nearestDistance ? index : nearestIndex;
      });
    },
    [dataFiltered, selected],
  );

  const closeDropdown = () => {
    refInput.current?.blur();
    refInput.current!.value = '';
    setIsDropdownOpen(false);
    setTextInput('');
  };

  const openDropdown = React.useCallback(() => {
    setIsDropdownOpen(true);
    setActiveIndex((current) => getNearestSelectedIndex(current));
  }, [getNearestSelectedIndex]);

  const onSelect = (item: T | null, filteredIndex = -1) => {
    setActiveIndex(filteredIndex);

    const newValue = [...(value || [])];

    const itemValue = item ? extractValueRef.current(item) : null;
    const selectedIndex = itemValue !== null ? newValue.indexOf(itemValue) : -1;

    if (selectedIndex >= 0) {
      newValue.splice(selectedIndex, 1);
    } else if (itemValue !== null) {
      newValue.push(itemValue);
    }

    onChange?.({ name, value: newValue });
  };

  const onClear = () => {
    closeDropdown();
    onChange?.({ name, value: [] });
  };

  const onInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    setTextInput(e.target.value);
    props.onInput?.(e);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const isEnter = e.key === 'Enter';
    const isUp = e.key === 'ArrowUp';
    const isDown = e.key === 'ArrowDown';

    if (!isEnter && !isUp && !isDown) return;

    e.preventDefault();

    if (!dataFiltered.length) return;

    if (!isDropdownOpen) {
      setIsDropdownOpen(true);
    }

    if (isDown) {
      setActiveIndex((current) => Math.min(current + 1, dataFiltered.length - 1));
      return;
    }

    if (isUp) {
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (isEnter && activeIndex >= 0) {
      const [, item] = dataFiltered[activeIndex];
      onSelect(item, activeIndex);
    }
  };

  const dropdownHeight = (dataFiltered.length || 1) * (itemSize + 2);
  const dropdownPositionStyle = useDropdownFixedPosition({
    anchorRef: refInput,
    dropdownHeight,
    isOpen: isDropdownOpen,
    offset: 12,
  });
  const dropdownStyle = React.useMemo(
    () =>
      ({
        ...dropdownPositionStyle,
        backgroundColor,
        color,
        ...toCssProperties({ height: `${dropdownHeight}px` }),
        '--autocomplete-hover-background-color': __colors.darkLight,
        '--autocomplete-selected-background-color': __colors.darkLightDeep,
        '--autocomplete-active-background-color': __colors.darkLightDeep,
        '--autocomplete-border-color': __colors.lightGray,
        '--autocomplete-shadow-color': __colors.shadow,
      }) as React.CSSProperties,
    [
      __colors.darkLight,
      __colors.darkLightDeep,
      __colors.lightGray,
      __colors.shadow,
      backgroundColor,
      color,
      dropdownHeight,
      dropdownPositionStyle,
    ],
  );

  React.useImperativeHandle(
    ref,
    () => ({
      clear: () => closeDropdown(),
      open: () => refInput.current?.focus(),
    }),
    [],
  );

  useDropdownOutsideClick({
    idContainer,
    idDropdown,
    isOpen: isDropdownOpen,
    onClose: closeDropdown,
  });

  React.useEffect(() => {
    if (!isDropdownOpen || activeIndex < 0 || !refScrollElement.current) return;

    refScrollElement.current.scrollTop = activeIndex * itemSize;
  }, [activeIndex, isDropdownOpen]);

  return (
    <Input
      {...gridSystem}
      useFakeInputToValidate
      autoComplete="off"
      spellCheck="false"
      id={id}
      idContainer={idContainer}
      label={label}
      name={name}
      className={className}
      required={required}
      title={selected.length ? selectedLabel : title}
      labelColor={labelColor}
      color={color}
      data-value={value}
      maxWidth={maxWidth}
      backgroundColor={backgroundColor}
      placeholderColor={color}
      placeholder={selected.length ? selectedLabel : placeholder}
      ref={refInput}
      onFocus={openDropdown}
      onChange={onInput}
      onKeyDown={onKeyDown}
      style={{ paddingRight: clearable ? '50px' : '30px', textOverflow: 'ellipsis' }}
      icon={() => {
        if (loading) {
          return (
            <SpinnerLoading
              background="transparent"
              color={color}
              size={12}
              thickness={2}
              padding="0"
            />
          );
        }

        if (selected.length && clearable) {
          return (
            <IconMdiClose title="Desmarcar" color={color} cursor="pointer" onClick={onClear} />
          );
        }

        return <IconMdiKeyboardArrowDown pointerEvents="none" color={color} />;
      }}
    >
      {!!(isDropdownOpen && dropdownPositionStyle) &&
        ReactDOM.createPortal(
          <div id={idDropdown} className={styles.dropdownContainer} style={dropdownStyle}>
            <VirtualizeList
              itemSize={itemSize}
              itemCount={dataFiltered.length}
              refScrollElement={refScrollElement}
              childrenStickySize={20}
              childrenSticky={
                !dataFiltered.length && <p className={styles.emptyMessage}>{emptyMessage}</p>
              }
            >
              {({ index }) => {
                const [real_index, item] = dataFiltered[index];

                const label = extractLabelRef.current(item);
                const isSelected =
                  selected.length &&
                  selected.find(
                    (v) => extractValueRef.current(v) === extractValueRef.current(item),
                  );
                const isActive = activeIndex === index;

                return (
                  <div
                    key={real_index}
                    onClick={() => onSelect(item, index)}
                    title={label}
                    className={classes(
                      styles.row,
                      isSelected && styles.selected,
                      isActive && styles.active,
                    )}
                  >
                    {label}
                  </div>
                );
              }}
            </VirtualizeList>
          </div>,
          document.body,
        )}
    </Input>
  );
}

export interface IAutocompleteMultiProps<T> extends IGridSystem {
  value?: (string | number)[];
  name?: string;
  id?: string;
  maxWidth?: string;
  className?: string;
  centerText?: boolean;
  required?: boolean;
  title?: string;
  icon?: React.ReactElement;
  color?: string;
  backgroundColor?: string;
  label?: string;
  labelColor?: string;
  extractLabel?: (item: T) => string;
  extractValue?: (item: T) => string | number;
  emptyMessage?: string;
  clearable?: boolean;
  ref?: React.Ref<IAutoCompleteMultiRef>;
  data: T[];
  loading?: boolean;
  placeholder?: string;
  onInput?(e: React.ChangeEvent<HTMLInputElement>): void;
  onChange?(params: { name?: string; value: (string | number)[] }): void;
}
