import React from 'react';
import { createPortal } from 'react-dom';
import { Toast } from '@renderer/components/Toast';
import { ToastsWrapper } from '@renderer/components/Toast/ToastsWrapper';
import { useToastStore } from '@renderer/stores/Toast';

export const ToastHost = () => {
  const toasts = useToastStore((state) => state.toasts);
  const closeToast = useToastStore((state) => state.closeToast);
  return createPortal(
    <ToastsWrapper>
      {toasts.map(({ id, ...toast }) => (
        <Toast key={id} {...toast} close={() => closeToast(id)} />
      ))}
    </ToastsWrapper>,
    document.body,
  );
};
