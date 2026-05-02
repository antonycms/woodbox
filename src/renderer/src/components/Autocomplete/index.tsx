import React from 'react';
import { SpinnerLoading } from '@renderer/components/Loaders';
import { Input } from '@renderer/components/Input';
import { VirtualizeList } from '@renderer/components/VirtualizeList';
import { IGridSystem } from '@renderer/components/Grid';
import useStateWithDebounce from '@renderer/hooks/useStateWithDebounce';
import { classes, toCssProperties } from '@renderer/styles/theme';
import { generateHash } from '@renderer/utils/string';

import IconMdiKeyboardArrowDown from '~icons/mdi/keyboard-arrow-down';
import IconMdiClose from '~icons/mdi/close';

import styles from './styles.module.css';

const defaultExtractLabel = (item: any) => (typeof item === 'string' ? item : item?.label);
const defaultExtractValue = (item: any) => (typeof item === 'string' ? item : item?.value);

export interface IAutoCompleteRef {
  clear: () => void;
  open: () => void;
}

export function Autocomplete<T = any>(props: IAutocompleteProps<T>) {
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

  const itemSize = 41;

  const refScrollElement = React.useRef<HTMLDivElement>(null);
  const refInput = React.useRef<HTMLInputElement>(null);
  const [idContainer] = React.useState(generateHash(10));
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
    if (value === null || value === undefined || !data) return null;

    return data.find((item) => extractValueRef.current(item) === value);
  }, [value, data]);

  const selectedLabel = selected ? extractLabelRef.current(selected) : undefined;

  const closeDropdown = () => {
    refInput.current?.blur();
    setIsDropdownOpen(false);

    refInput.current!.value = '';
    setTextInput('');
  };

  const onSelect = (item: T | null, index: number) => {
    closeDropdown();
    setActiveIndex(index);
    onChange?.({ index, name, item, value: item && extractValueRef.current(item) });
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
      const [realIndex, item] = dataFiltered[activeIndex];
      onSelect(item, realIndex);
    }
  };

  const dropdownHeight = (dataFiltered.length || 1) * (itemSize + 2);

  // value ref
  React.useImperativeHandle(
    ref,
    () => ({
      clear: () => closeDropdown(),
      open: () => refInput.current?.focus(),
    }),
    [],
  );

  // Clique fora para fechar
  React.useEffect(() => {
    const onClickOutside = (e: Event) => {
      const container = document.getElementById(idContainer);

      if (container && !container.contains(e.target as Node)) closeDropdown();
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('focusin', onClickOutside);

    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('focusin', onClickOutside);
    };
  }, []);

  // Scrolla para o item selecionado ao abrir o dropdown
  React.useEffect(() => {
    if (!isDropdownOpen || activeIndex < 0 || !refScrollElement.current) return;

    refScrollElement.current.scrollTop = activeIndex * itemSize;
  }, [activeIndex, isDropdownOpen]);

  return (
    <Input
      {...gridSystem}
      useFakeInputToValidate={!!value}
      autoComplete="off"
      spellCheck="false"
      id={id}
      idContainer={idContainer}
      label={label}
      name={name}
      className={className}
      required={required}
      title={title}
      labelColor={labelColor}
      color={color}
      data-value={value}
      maxWidth={maxWidth}
      backgroundColor={backgroundColor}
      placeholderColor={color}
      placeholder={selected ? selectedLabel : placeholder}
      ref={refInput}
      onFocus={() => setIsDropdownOpen(true)}
      onChange={onInput}
      onKeyDown={onKeyDown}
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

        if (selected && clearable) {
          return (
            <IconMdiClose
              title="Desmarcar"
              color={color}
              cursor="pointer"
              onClick={() => onSelect(null, -1)}
            />
          );
        }

        return <IconMdiKeyboardArrowDown pointerEvents="none" color={color} />;
      }}
    >
      {!!(isDropdownOpen && dataFiltered.length) && (
        <div
          className={styles.dropdownContainer}
          style={{ backgroundColor, ...toCssProperties({ height: `${dropdownHeight}px` }) }}
        >
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
                selected && extractValueRef.current(selected) === extractValueRef.current(item);
              const isActive = activeIndex === index;

              return (
                <div
                  key={real_index}
                  onClick={() => onSelect(item, real_index)}
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
        </div>
      )}
    </Input>
  );
}

export interface IAutocompleteProps<T> extends IGridSystem {
  value?: string | number | boolean | null;
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
  ref?: React.Ref<IAutoCompleteRef>;
  data: T[];
  loading?: boolean;
  placeholder?: string;
  registerable?: boolean;
  onInput?(e: React.ChangeEvent<HTMLInputElement>): void;
  onChange?(params: {
    index: number;
    name?: string;
    value: string | number | null;
    item: T | null;
  }): void;
}
