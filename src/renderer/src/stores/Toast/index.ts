import { create } from 'zustand';
import { generateHash } from '@shared/utils/string';
import type { IToastStore } from './types';

export const useToastStore = create<IToastStore>()((set) => ({
  toasts: [],
  showToast: ({ title, type, delay = 5000, description }) =>
    set((state) => ({
      toasts: [...state.toasts, { id: generateHash(), title, type, delay, description }],
    })),
  closeToast: (id) => set((state) => ({ toasts: state.toasts.filter((toast) => toast.id !== id) })),
}));
