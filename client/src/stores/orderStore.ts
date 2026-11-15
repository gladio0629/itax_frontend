import { create } from "zustand";
import type { OrderMode, PaymentMethod } from "@/seed/generate";
import type { AddressDetails, CargoContact, CargoInput, CarClassId, OptionVariants, OrderOptionId, OrderTiming, Rider, ServiceType } from "@/api/types";

// The pickup a new draft starts from. The ordering flow sets it when it
// loads (from its address book), so this store doesn't pull address data
// into builds that have no ordering flow.
let defaultFromAddress = "";

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
  /** Kargo contacts. */
  sender: Rider;
  receiver: CargoContact;
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
  fromAddressId: "",
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
  sender: { kind: "me" },
  receiver: { name: "", phone: "" },
  mode: "car",
  seatIds: [],
  // Kargo starts on Shaharlararo: step 1's route is always between cities.
  cargo: { vehicle: "spark", tab: "intercity", loaders: 0, pricingMode: "route", rideAlong: false },
  paymentMethod: "cash",
  timing: { timeMode: "now" },
  promoCode: "",
};

export const useOrderStore = create<OrderDraftState>((set, get) => ({
  draft: { ...initialDraft },
  activeOrderId: null,
  setField: (key, value) => set({ draft: { ...get().draft, [key]: value } }),
  reset: () => set({ draft: { ...initialDraft, fromAddressId: defaultFromAddress } }),
  setActiveOrderId: (id) => set({ activeOrderId: id }),
}));

/** Called once by the ordering flow when it loads: new drafts (and the
 * current one, if it has no pickup yet) start from this address. */
export function setDefaultFromAddress(id: string) {
  defaultFromAddress = id;
  const { draft } = useOrderStore.getState();
  if (!draft.fromAddressId) useOrderStore.setState({ draft: { ...draft, fromAddressId: id } });
}
