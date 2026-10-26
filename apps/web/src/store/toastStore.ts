import { create } from 'zustand';

export type ToastTone = 'info' | 'success' | 'warning' | 'danger';

export type Toast = {
  id: string;
  message: string;
  tone: ToastTone;
};

type ToastState = {
  toasts: Toast[];
  push: (message: string, tone?: ToastTone) => void;
  dismiss: (id: string) => void;
  clear: () => void;
};

let toastCounter = 0;

export const useToastStore = create<ToastState>((set, get) => ({
  toasts: [],
  push: (message, tone = 'info') => {
    toastCounter += 1;
    const id = `toast-${Date.now()}-${toastCounter}`;
    set((state) => ({ toasts: [...state.toasts.slice(-2), { id, message, tone }] }));
    window.setTimeout(() => {
      get().dismiss(id);
    }, 4200);
  },
  dismiss: (id) =>
    set((state) => ({
      toasts: state.toasts.filter((toast) => toast.id !== id),
    })),
  clear: () => set({ toasts: [] }),
}));
