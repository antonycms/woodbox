import React from 'react';
import { useLatestFunc } from '@renderer/hooks/useLatestFunc';

interface IUseDropdownOutsideClickParams {
  idContainer: string;
  isOpen: boolean;
  onClose(): void;
}

export function useDropdownOutsideClick({
  idContainer,
  isOpen,
  onClose,
}: IUseDropdownOutsideClickParams) {
  const onCloseLatest = useLatestFunc(onClose);

  React.useEffect(() => {
    if (!isOpen) return;

    const onClickOutside = (event: Event) => {
      const container = document.getElementById(idContainer);

      if (container && !container.contains(event.target as Node)) onCloseLatest();
    };

    document.addEventListener('mousedown', onClickOutside);
    document.addEventListener('focusin', onClickOutside);

    return () => {
      document.removeEventListener('mousedown', onClickOutside);
      document.removeEventListener('focusin', onClickOutside);
    };
  }, [idContainer, isOpen, onCloseLatest]);
}
