import { generateSeed, type SeedData, type Order, type Driver, type WalletEntry } from "@/seed/generate";
import { readJSON, writeJSON } from "./storage";

export type ReviewKind =
  | "otp_verify"
  | "driver_registration"
  | "wallet_topup";

export type ReviewRequest = {
  id: string;
  kind: ReviewKind;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  resolvesAt: number;
  payload?: Record<string, unknown>;
};

let cache: SeedData | null = null;

function load(): SeedData {
  if (cache) return cache;
  const stored = readJSON<SeedData | null>("db", null);
  if (stored) {
    cache = stored;
    return cache;
  }
  const fresh = generateSeed();
  writeJSON("db", fresh);
  cache = fresh;
  return cache;
}

function persist() {
  if (cache) writeJSON("db", cache);
}

// The driver "logged in" for this demo session — fixed so the app has a
// consistent identity across reloads without a real auth backend.
const CURRENT_DRIVER_ID = "drv_01";

export const db = {
  cities: () => load().cities,
  tariffs: () => load().tariffs,
  drivers: () => load().drivers,
  passengers: () => load().passengers,
  orders: () => load().orders,
  walletEntries: () => load().walletEntries,
  complaints: () => load().complaints,

  currentDriverId: () => CURRENT_DRIVER_ID,
  currentDriver(): Driver {
    const d = load().drivers.find((x) => x.id === CURRENT_DRIVER_ID);
    if (!d) throw new Error("Haydovchi topilmadi");
    return d;
  },

  updateDriver(id: string, patch: Partial<Driver>) {
    const d = load().drivers.find((x) => x.id === id);
    if (d) Object.assign(d, patch);
    persist();
  },

  addWalletEntry(entry: WalletEntry) {
    load().walletEntries.push(entry);
    persist();
  },

  addOrder(order: Order) {
    load().orders.unshift(order);
    persist();
  },
  updateOrder(id: string, patch: Partial<Order>) {
    const o = load().orders.find((x) => x.id === id);
    if (o) Object.assign(o, patch);
    persist();
  },
  getOrder(id: string) {
    return load().orders.find((x) => x.id === id);
  },
};

const REVIEW_KEY = "review_requests";

export function getReviewRequests(): ReviewRequest[] {
  return readJSON<ReviewRequest[]>(REVIEW_KEY, []);
}

export function saveReviewRequest(req: ReviewRequest) {
  const all = getReviewRequests().filter((r) => r.id !== req.id);
  all.unshift(req);
  writeJSON(REVIEW_KEY, all);
}

export function getReviewRequest(id: string): ReviewRequest | undefined {
  return getReviewRequests().find((r) => r.id === id);
}
