import React from 'react';
import { createPortal } from 'react-dom';
import { Toast, ToastType } from '@renderer/components/Toast';
import { ToastsWrapper } from '@renderer/components/Toast/ToastsWrapper';
import { generateHash } from '@renderer/utils/string';

const ToastContext = React.createContext<IToastContext>({} as IToastContext);

const ToastProvider = ({ children }) => {
  const [toasts, setToasts] = React.useState<IToastInfo[]>([]);

  const showToast = (options: IToastOptions) => {
    const { title, type, delay = 5000, description } = options;

    const toastInfo = {
      id: generateHash(),
      type,
      title,
      description,
      delay,
    };

    setToasts((prevState) => [...prevState, toastInfo]);
  };

  const close = (id: string) => {
    setToasts((prevState) => prevState.filter((toast) => toast.id !== id));
  };

  const value = React.useMemo(() => ({ showToast }), []);

  return (
    <ToastContext.Provider value={value}>
      {children}

      {createPortal(
        <ToastsWrapper>
          {toasts.map(({ id, type, title, delay, description }) => (
            <Toast
              type={type}
              key={id}
              title={title}
              description={description}
              delay={delay}
              close={() => close(id)}
            />
          ))}
        </ToastsWrapper>,
        document.body,
      )}
    </ToastContext.Provider>
  );
};

export default ToastProvider;

export const useToast = () => {
  return React.useContext(ToastContext);
};

export interface IToastContext {
  showToast(options: IToastOptions): void;
}

export interface IToastInfo {
  id: string;
  type: ToastType;
  title: string;
  description: string;
  delay: number;
}

export interface IToastOptions {
  type: ToastType;
  title: string;
  description?: string;

  /**
   * delay to close modal (ms)
   * @default 5000
   */
  delay?: number;
}
