import React from 'react';
import { useLatestFunc } from '@renderer/hooks/useLatestFunc';

interface IUseDropdownOutsideClickParams {
  idContainer: string;
  idDropdown?: string;
  isOpen: boolean;
  onClose(): void;
}

export function useDropdownOutsideClick({
  idContainer,
  idDropdown,
  isOpen,
  onClose,
}: IUseDropdownOutsideClickParams) {
  const onCloseLatest = useLatestFunc(onClose);

  React.useEffect(() => {
    if (!isOpen) return;

    const onClickOutside = (event: Event) => {
      const container = document.getElementById(idContainer);
      const dropdown = idDropdown ? document.getElementById(idDropdown) : null;
      const target = event.target as Node;

      if (container?.contains(target) || dropdown?.contains(target)) return;

      onCloseLatest();
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('focusin', onClickOutside);

    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('focusin', onClickOutside);
    };
  }, [idContainer, idDropdown, isOpen, onCloseLatest]);
}
