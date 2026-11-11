import { create } from "zustand";
import type { OrderMode, PaymentMethod } from "@/seed/generate";
import type { CargoInput, OrderTiming, ServiceType } from "@/api/types";
import { ADDRESSES } from "@/clientData/addresses";

const DEFAULT_FROM_ADDRESS = ADDRESSES.find((a) => a.cityId === "tsh")?.id ?? ADDRESSES[0]?.id ?? "";

export type OrderDraft = {
  serviceType: ServiceType;
  fromAddressId: string;
  toAddressId: string;
  mode: OrderMode;
  seatIds: string[];
  cargo: CargoInput;
  paymentMethod: PaymentMethod;
  timing: OrderTiming;
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
  serviceType: "passenger",
  fromAddressId: DEFAULT_FROM_ADDRESS,
  toAddressId: "",
  mode: "car",
  seatIds: [],
  cargo: { vehicle: "spark" },
  paymentMethod: "cash",
  timing: { timeMode: "now" },
  promoCode: "",
};

export const useOrderStore = create<OrderDraftState>((set, get) => ({
  draft: { ...initialDraft },
  activeOrderId: null,
  setField: (key, value) => set({ draft: { ...get().draft, [key]: value } }),
  reset: () => set({ draft: { ...initialDraft } }),
  setActiveOrderId: (id) => set({ activeOrderId: id }),
}));
