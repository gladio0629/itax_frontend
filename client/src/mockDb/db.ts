import { generateSeed, type SeedData, type Order, type Passenger } from "@/seed/generate";
import { readJSON, writeJSON } from "./storage";

export type ReviewKind =
  | "otp_verify"
  | "card_link"
  | "wallet_topup"
  | "support_ticket"
  | "bonus_withdraw"
  | "phone_change"
  | "account_add"
  | "account_delete";

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

export const db = {
  cities: () => load().cities,
  tariffs: () => load().tariffs,
  drivers: () => load().drivers,
  passengers: () => load().passengers,
  orders: () => load().orders,
  walletEntries: () => load().walletEntries,
  complaints: () => load().complaints,

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
  updatePassenger(id: string, patch: Partial<Passenger>) {
    const p = load().passengers.find((x) => x.id === id);
    if (p) Object.assign(p, patch);
    persist();
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
