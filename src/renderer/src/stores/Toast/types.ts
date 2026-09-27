import type { ToastType } from '@renderer/components/Toast';

export interface IToastStore {
  toasts: IToastInfo[];
  closeToast(id: string): void;
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
