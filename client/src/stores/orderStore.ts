import { create } from "zustand";
import type { OrderMode, PaymentMethod } from "@/seed/generate";
import type { AddressDetails, CargoInput, CarClassId, OptionVariants, OrderOptionId, OrderTiming, Rider, ServiceType } from "@/api/types";
import { ADDRESSES } from "@/clientData/addresses";

const DEFAULT_FROM_ADDRESS = ADDRESSES.find((a) => a.cityId === "tsh")?.id ?? ADDRESSES[0]?.id ?? "";

/** An intermediate stop in the draft. `uid` is a client-side key for React
 * and drag-to-reorder; the adapter only ever sees the address id. */
export type DraftStop = { uid: string; addressId: string; details: AddressDetails };

let stopSeq = 0;
export function newStopUid() {
  stopSeq += 1;
  return `stop_${stopSeq}`;
}

export type OrderDraft = {
  serviceType: ServiceType;
  fromAddressId: string;
  toAddressId: string;
  fromDetails: AddressDetails;
  toDetails: AddressDetails;
  stops: DraftStop[];
  comment: string;
  optionIds: OrderOptionId[];
  optionVariants: OptionVariants;
  carClass: CarClassId;
  luggage: number;
  rider: Rider;
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
  fromDetails: {},
  toDetails: {},
  stops: [],
  comment: "",
  optionIds: [],
  optionVariants: {},
  carClass: "standart",
  luggage: 0,
  rider: { kind: "me" },
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
