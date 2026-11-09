import {
  generateSeed,
  type SeedData,
  type Driver,
  type Order,
  type Complaint,
  type Tariff,
  type WalletEntry,
} from "@/seed/generate";
import { readJSON, writeJSON } from "./storage";

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
  generatedAt: () => load().generatedAt,
  cities: () => load().cities,
  tariffs: () => load().tariffs,
  drivers: () => load().drivers,
  passengers: () => load().passengers,
  orders: () => load().orders,
  walletEntries: () => load().walletEntries,
  complaints: () => load().complaints,

  getDriver(id: string) {
    return load().drivers.find((d) => d.id === id);
  },
  updateDriver(id: string, patch: Partial<Driver>) {
    const d = load().drivers.find((x) => x.id === id);
    if (d) Object.assign(d, patch);
    persist();
  },

  getOrder(id: string) {
    return load().orders.find((o) => o.id === id);
  },
  updateOrder(id: string, patch: Partial<Order>) {
    const o = load().orders.find((x) => x.id === id);
    if (o) Object.assign(o, patch);
    persist();
  },

  updateComplaint(id: string, patch: Partial<Complaint>) {
    const c = load().complaints.find((x) => x.id === id);
    if (c) Object.assign(c, patch);
    persist();
  },

  updateTariff(id: string, patch: Partial<Tariff>) {
    const t = load().tariffs.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
    persist();
  },

  addWalletEntry(entry: WalletEntry) {
    load().walletEntries.push(entry);
    persist();
  },
};

// ---------------------------------------------------------------------
// Admin-only entities. These never ship in the client/driver apps — the
// shared seed above is identical everywhere, but an admin dashboard needs
// extra bookkeeping (who is logged in, audit trail, tariff proposals)
// that has no equivalent on the passenger/driver side.
// ---------------------------------------------------------------------

export type AdminRole = "superadmin" | "ops" | "support" | "finance";

export type AdminUser = {
  id: string;
  name: string;
  email: string;
  role: AdminRole;
  avatarSeed: string;
};

export const ADMIN_USERS: AdminUser[] = [
  { id: "adm_01", name: "Kamola Yusupova", email: "kamola@izgo.uz", role: "superadmin", avatarSeed: "aa0" },
  { id: "adm_02", name: "Javlon Rashidov", email: "javlon@izgo.uz", role: "finance", avatarSeed: "aa1" },
  { id: "adm_03", name: "Shahnoza Tursunova", email: "shahnoza@izgo.uz", role: "support", avatarSeed: "aa2" },
];
export const CURRENT_ADMIN_ID = "adm_01";
export const DEMO_PASSWORD = "demo1234";

const ROLES_KEY = "admin_roles";
export function getAdminUsers(): AdminUser[] {
  const overrides = readJSON<Record<string, AdminRole>>(ROLES_KEY, {});
  return ADMIN_USERS.map((u) => (overrides[u.id] ? { ...u, role: overrides[u.id] } : u));
}
export function setAdminRole(id: string, role: AdminRole) {
  const overrides = readJSON<Record<string, AdminRole>>(ROLES_KEY, {});
  overrides[id] = role;
  writeJSON(ROLES_KEY, overrides);
}

export type AuditAction =
  | "login"
  | "2fa_verify"
  | "driver_approve"
  | "driver_reject"
  | "phone_reveal"
  | "tariff_propose"
  | "tariff_second_approve"
  | "tariff_reject"
  | "complaint_resolve"
  | "complaint_dismiss"
  | "role_change"
  | "wallet_adjust";

export type AuditEntry = {
  id: string;
  actorId: string;
  actorName: string;
  action: AuditAction;
  targetType: string;
  targetId: string;
  detail: string;
  createdAt: number;
};

const AUDIT_KEY = "audit_log";
export function getAuditLog(): AuditEntry[] {
  return readJSON<AuditEntry[]>(AUDIT_KEY, []);
}
export function addAuditEntry(entry: Omit<AuditEntry, "id" | "createdAt">): AuditEntry {
  const full: AuditEntry = {
    ...entry,
    id: `aud_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
    createdAt: Date.now(),
  };
  const all = [full, ...getAuditLog()];
  writeJSON(AUDIT_KEY, all);
  return full;
}

export type ReviewKind = "admin_2fa" | "tariff_second_approve";
export type ReviewRequest = {
  id: string;
  kind: ReviewKind;
  status: "pending" | "approved" | "rejected";
  createdAt: number;
  resolvesAt: number;
  payload?: Record<string, unknown>;
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

export type TariffProposal = {
  id: string;
  patch: Partial<Tariff>;
  proposedById: string;
  proposedByName: string;
  status: "pending_second" | "approved" | "rejected";
  reviewRequestId?: string;
  createdAt: number;
  resolvedAt?: number;
};
const TARIFF_PROPOSALS_KEY = "tariff_proposals";
export function getTariffProposals(): TariffProposal[] {
  return readJSON<TariffProposal[]>(TARIFF_PROPOSALS_KEY, []);
}
export function saveTariffProposal(p: TariffProposal) {
  const all = getTariffProposals().filter((x) => x.id !== p.id);
  all.unshift(p);
  writeJSON(TARIFF_PROPOSALS_KEY, all);
}

const TWO_FACTOR_KEY = "two_factor_codes";
export function saveTwoFactorCode(requestId: string, code: string) {
  const all = readJSON<Record<string, string>>(TWO_FACTOR_KEY, {});
  all[requestId] = code;
  writeJSON(TWO_FACTOR_KEY, all);
}
export function consumeTwoFactorCode(requestId: string): string | undefined {
  const all = readJSON<Record<string, string>>(TWO_FACTOR_KEY, {});
  const code = all[requestId];
  delete all[requestId];
  writeJSON(TWO_FACTOR_KEY, all);
  return code;
}

const SESSION_KEY = "session";
export function getSession(): { adminId: string } | null {
  return readJSON<{ adminId: string } | null>(SESSION_KEY, null);
}
export function setSession(session: { adminId: string } | null) {
  writeJSON(SESSION_KEY, session);
}
