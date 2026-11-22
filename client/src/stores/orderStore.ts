import { create } from "zustand";
import type { OrderMode } from "@/seed/generate";
import type { PayMethod, AddressDetails, CargoContact, CargoInput, CarClassId, OrderTiming, Rider, ServiceType } from "@/api/types";

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
  carClass: CarClassId;
  luggage: number;
  rider: Rider;
  /** Kargo contacts. */
  sender: Rider;
  receiver: CargoContact;
  mode: OrderMode;
  seatIds: string[];
  cargo: CargoInput;
  paymentMethod: PayMethod;
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
  carClass: "standart",
  luggage: 0,
  rider: { kind: "me" },
  sender: { kind: "me" },
  receiver: { name: "", phone: "" },
  mode: "car",
  seatIds: [],
  // Kargo starts on Shaharlararo: step 1's route is always between cities.
  // Body M first (design v2: "Boshlang'ich: M"); the sizes are the server's.
  cargo: { vehicle: "damas", tab: "intercity", loaders: 0, pricingMode: "route", rideAlong: false, insurance: false },
  paymentMethod: "cash",
  timing: { timeMode: "now" },
  promoCode: "",
};

export const useOrderStore = create<OrderDraftState>((set, get) => ({
  draft: { ...initialDraft },
  activeOrderId: null,
  setField: (key, value) => set({ draft: { ...get().draft, [key]: value } }),
  // Without a default pickup (real backend), a new draft keeps the last one.
  reset: () => set({ draft: { ...initialDraft, fromAddressId: defaultFromAddress || get().draft.fromAddressId } }),
  setActiveOrderId: (id) => set({ activeOrderId: id }),
}));

/** Called once by the ordering flow when it loads: new drafts (and the
 * current one, if it has no pickup yet) start from this address. */
export function setDefaultFromAddress(id: string) {
  defaultFromAddress = id;
  const { draft } = useOrderStore.getState();
  if (!draft.fromAddressId) useOrderStore.setState({ draft: { ...draft, fromAddressId: id } });
}
