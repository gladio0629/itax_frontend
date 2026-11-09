import { create } from "zustand";
import type { OrderMode, PaymentMethod } from "@/seed/generate";

type OrderDraft = {
  fromCityId: string;
  toCityId: string;
  mode: OrderMode;
  seatIds: string[];
  timeMode: "now" | "range";
  timeRange: { from: string; to: string };
  paymentMethod: PaymentMethod;
  promoCode: string;
};

type OrderDraftState = {
  draft: OrderDraft;
  activeOrderId: string | null;
  setField: <K extends keyof OrderDraft>(key: K, value: OrderDraft[K]) => void;
  reset: () => void;
  setActiveOrderId: (id: string | null) => void;
};

const initialDraft: OrderDraft = {
  fromCityId: "",
  toCityId: "",
  mode: "car",
  seatIds: [],
  timeMode: "now",
  timeRange: { from: "08:00", to: "12:00" },
  paymentMethod: "cash",
  promoCode: "",
};

export const useOrderStore = create<OrderDraftState>((set, get) => ({
  draft: { ...initialDraft },
  activeOrderId: null,
  setField: (key, value) => set({ draft: { ...get().draft, [key]: value } }),
  reset: () => set({ draft: { ...initialDraft } }),
  setActiveOrderId: (id) => set({ activeOrderId: id }),
}));
