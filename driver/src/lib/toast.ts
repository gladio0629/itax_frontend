import { create } from "zustand";

export type ToastTone = "neutral" | "danger" | "success";
type ToastItem = { id: number; message: string; tone: ToastTone };

type ToastState = { items: ToastItem[]; show: (message: string, tone?: ToastTone) => void; dismiss: (id: number) => void };

let nextId = 1;
export const useToast = create<ToastState>((set, get) => ({
  items: [],
  show: (message, tone = "neutral") => {
    const id = nextId++;
    set({ items: [...get().items.filter((t) => t.message !== message), { id, message, tone }].slice(-2) });
    setTimeout(() => get().dismiss(id), 3200);
  },
  dismiss: (id) => set({ items: get().items.filter((t) => t.id !== id) }),
}));

export const toast = (message: string, tone?: ToastTone) => useToast.getState().show(message, tone);
