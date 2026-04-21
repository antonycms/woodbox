import type { ToastType } from '@renderer/components/Toast';
import { createContext } from 'react';

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

export default createContext<IToastContext>({} as IToastContext);
