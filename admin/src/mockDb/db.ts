import {
  generateSeed,
  SCHEMA_VERSION,
  type SeedData,
  type Driver,
  type Passenger,
  type Order,
  type Complaint,
  type ComplaintNote,
  type Tariff,
  type WalletEntry,
} from "@/seed/generate";
import { makeRng } from "@/lib/prng";
import { readJSON, writeJSON, clearAppStorage, readSessionJSON, writeSessionJSON, clearSessionStorage } from "./storage";

let cache: SeedData | null = null;

function load(): SeedData {
  if (cache) return cache;
  const stored = readJSON<SeedData | null>("db", null);
  if (stored && stored.schemaVersion === SCHEMA_VERSION) {
    cache = stored;
    return cache;
  }
  if (stored) {
    // Persisted data is from an older shape of the mock "server" — rather
    // than crash on missing/renamed fields, wipe this app's storage and
    // reseed everything (staff, audit log, proposals included).
    clearAppStorage();
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

  getPassenger(id: string) {
    return load().passengers.find((p) => p.id === id);
  },
  updatePassenger(id: string, patch: Partial<Passenger>) {
    const p = load().passengers.find((x) => x.id === id);
    if (p) Object.assign(p, patch);
    persist();
  },
  addPassenger(passenger: Passenger) {
    load().passengers.unshift(passenger);
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
  addOrder(order: Order) {
    load().orders.unshift(order);
    persist();
  },

  updateComplaint(id: string, patch: Partial<Complaint>) {
    const c = load().complaints.find((x) => x.id === id);
    if (c) Object.assign(c, patch);
    persist();
  },
  addComplaintNote(id: string, note: ComplaintNote) {
    const c = load().complaints.find((x) => x.id === id);
    if (c) c.notes.push(note);
    persist();
  },

  getTariff(id: string) {
    return load().tariffs.find((t) => t.id === id);
  },
  updateTariff(id: string, patch: Partial<Tariff>) {
    const t = load().tariffs.find((x) => x.id === id);
    if (t) Object.assign(t, patch);
    persist();
  },
  addTariff(tariff: Tariff) {
    load().tariffs.push(tariff);
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
// extra bookkeeping (staff, sessions, audit trail, review requests,
// operator windows) that has no equivalent on the passenger/driver side.
// ---------------------------------------------------------------------

export type AdminRole = "superadmin" | "owner" | "menejer" | "marketolog" | "operator";
export type StaffStatus = "active" | "blocked";

export type AdminUser = {
  id: string;
  name: string;
  /** Required for every role except "operator" — operators log in with a
   * phone SMS code only, so they may not have an email at all. Empty
   * string means "no email", never null/undefined, to keep every screen's
   * display code simple. */
  email: string;
  phone: string;
  role: AdminRole;
  status: StaffStatus;
  archived: boolean;
  avatarSeed: string;
  createdByAdminId?: string;
  createdAt: number;
  lastLoginAt?: number;
};

// --- Permissions matrix. This is the ONLY place role → access is decided.
// usePermissions() (client-side) and every adapter method that mutates
// staff/reviews read from this; nothing else branches on `role` directly. ---

export type Section =
  | "stats"
  | "drivers"
  | "passengers"
  | "orders"
  | "wallet"
  | "tariffs"
  | "complaints"
  | "staff"
  | "operators"
  | "audit";

/** "export" gates the CSV buttons. "operatorWork" is the one operator
 * action (start/finish/reject a call task) — the adapter rejects the
 * mutation for anyone without it, not just the UI hiding the button.
 * "operatorSupervise" is the read-only superadmin/owner/menejer view of
 * every operator's Navbat/Jarayonda/Bugungi tasdiqlanganlar. The single
 * "operators" section renders a different screen depending on which of
 * the two the role has — never a `role === "operator"` check. */
export type Action = "export" | "operatorWork" | "operatorSupervise";

export const ALL_ROLES: AdminRole[] = ["superadmin", "owner", "menejer", "marketolog", "operator"];

const ALL_SECTIONS: Section[] = [
  "stats",
  "drivers",
  "passengers",
  "orders",
  "wallet",
  "tariffs",
  "complaints",
  "staff",
  "operators",
  "audit",
];

export const ROLE_SECTIONS: Record<AdminRole, Section[]> = {
  superadmin: ALL_SECTIONS,
  owner: ALL_SECTIONS,
  menejer: ALL_SECTIONS,
  marketolog: ["stats"],
  operator: ["operators"],
};

export const ROLE_ACTIONS: Record<AdminRole, Action[]> = {
  superadmin: ["export", "operatorSupervise"],
  owner: ["export", "operatorSupervise"],
  menejer: ["operatorSupervise"],
  marketolog: [],
  operator: ["operatorWork"],
};

export const CREATABLE_ROLES: Record<AdminRole, AdminRole[]> = {
  superadmin: ["superadmin", "owner", "menejer", "marketolog", "operator"],
  owner: ["menejer", "marketolog", "operator"],
  menejer: ["marketolog", "operator"],
  marketolog: [],
  operator: [],
};

export const ROLE_LANDING: Record<AdminRole, string> = {
  superadmin: "/dashboard",
  owner: "/dashboard",
  menejer: "/dashboard",
  marketolog: "/dashboard",
  operator: "/operators",
};

export function canCreateRole(actorRole: AdminRole, targetRole: AdminRole): boolean {
  return CREATABLE_ROLES[actorRole].includes(targetRole);
}

// Reserved domains/numbers only — never a real email or phone, even a fake-looking real one.
const DEFAULT_STAFF: AdminUser[] = [
  {
    id: "adm_01",
    name: "Kamola Yusupova",
    email: "kamola@izgo.example",
    phone: "+998 90 000 00 01",
    role: "superadmin",
    status: "active",
    archived: false,
    avatarSeed: "aa0",
    createdAt: Date.UTC(2025, 2, 1),
  },
  {
    id: "adm_02",
    name: "Behzod Alimov",
    email: "behzod@izgo.example",
    phone: "+998 90 000 00 02",
    role: "owner",
    status: "active",
    archived: false,
    avatarSeed: "aa1",
    createdAt: Date.UTC(2025, 2, 1),
  },
  {
    id: "adm_03",
    name: "Javlon Rashidov",
    email: "javlon@izgo.example",
    phone: "+998 90 000 00 03",
    role: "menejer",
    status: "active",
    archived: false,
    avatarSeed: "aa2",
    createdByAdminId: "adm_02",
    createdAt: Date.UTC(2025, 4, 10),
  },
  {
    id: "adm_04",
    name: "Shahnoza Tursunova",
    email: "shahnoza@izgo.example",
    phone: "+998 90 000 00 04",
    role: "marketolog",
    status: "active",
    archived: false,
    avatarSeed: "aa3",
    createdByAdminId: "adm_03",
    createdAt: Date.UTC(2025, 5, 20),
  },
  {
    id: "adm_05",
    name: "Dilnoza Qosimova",
    email: "",
    phone: "+998 90 000 00 05",
    role: "operator",
    status: "active",
    archived: false,
    avatarSeed: "aa4",
    createdByAdminId: "adm_03",
    createdAt: Date.UTC(2025, 6, 2),
  },
  {
    id: "adm_06",
    name: "Oybek Niyazov",
    email: "",
    phone: "+998 90 000 00 06",
    role: "operator",
    status: "blocked",
    archived: false,
    avatarSeed: "aa5",
    createdByAdminId: "adm_03",
    createdAt: Date.UTC(2025, 7, 15),
  },
  {
    id: "adm_07",
    name: "Sevinch Yo'ldasheva",
    email: "",
    phone: "+998 90 000 00 07",
    role: "operator",
    status: "active",
    archived: false,
    avatarSeed: "aa6",
    createdByAdminId: "adm_03",
    createdAt: Date.UTC(2025, 8, 3),
  },
];

const STAFF_KEY = "staff";
export function getStaff(): AdminUser[] {
  const existing = readJSON<AdminUser[] | null>(STAFF_KEY, null);
  if (existing) return existing;
  writeJSON(STAFF_KEY, DEFAULT_STAFF);
  return DEFAULT_STAFF;
}
export function getStaffMember(id: string): AdminUser | undefined {
  return getStaff().find((u) => u.id === id);
}
export function findStaffByEmailOrPhone(value: string): AdminUser | undefined {
  const v = value.trim().toLowerCase();
  if (!v) return undefined;
  return getStaff().find((u) => (u.email && u.email.toLowerCase() === v) || u.phone.replace(/\s+/g, "") === v.replace(/\s+/g, ""));
}
export function saveStaff(list: AdminUser[]) {
  writeJSON(STAFF_KEY, list);
}
export function upsertStaffMember(user: AdminUser) {
  const all = getStaff().filter((u) => u.id !== user.id);
  all.push(user);
  saveStaff(all);
}

export const DEMO_PASSWORD = "demo1234";

export type AuditAction =
  | "login_requested"
  | "login_verified"
  | "logout"
  | "driver_edit"
  | "driver_block"
  | "driver_unblock"
  | "driver_archive"
  | "driver_restore"
  | "passenger_create"
  | "passenger_edit"
  | "passenger_block"
  | "passenger_unblock"
  | "passenger_archive"
  | "passenger_restore"
  | "order_create"
  | "order_edit"
  | "order_cancel"
  | "wallet_adjust_propose"
  | "wallet_adjust_approve"
  | "wallet_adjust_reject"
  | "tariff_propose"
  | "tariff_second_approve"
  | "tariff_reject"
  | "complaint_assign"
  | "complaint_status"
  | "complaint_note"
  | "complaint_close"
  | "staff_create"
  | "staff_edit"
  | "staff_block"
  | "staff_unblock"
  | "staff_archive"
  | "staff_restore"
  | "operator_task_start"
  | "operator_task_result"
  | "operator_history_edit"
  | "export";

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

export type ReviewKind = "login_2fa" | "tariff_second_approve" | "wallet_adjust_second_approve";
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

export type TariffProposalType = "create" | "edit" | "archive";
export type TariffProposal = {
  id: string;
  type: TariffProposalType;
  tariffId?: string;
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

export type AdjustmentProposal = {
  id: string;
  driverId: string;
  amount: number;
  reason: string;
  proposedById: string;
  proposedByName: string;
  status: "pending_second" | "approved" | "rejected";
  reviewRequestId?: string;
  createdAt: number;
  resolvedAt?: number;
};
const ADJUSTMENT_KEY = "wallet_adjustment_proposals";
export function getAdjustmentProposals(): AdjustmentProposal[] {
  return readJSON<AdjustmentProposal[]>(ADJUSTMENT_KEY, []);
}
export function saveAdjustmentProposal(p: AdjustmentProposal) {
  const all = getAdjustmentProposals().filter((x) => x.id !== p.id);
  all.unshift(p);
  writeJSON(ADJUSTMENT_KEY, all);
}

// --- Session lives in sessionStorage only: cleared on tab close, never
// "remembered", and untouched by a reset of the mock server's own data. ---
export type Session = { adminId: string };
const SESSION_KEY = "session";
export function getSession(): Session | null {
  return readSessionJSON<Session | null>(SESSION_KEY, null);
}
export function setSession(session: Session | null) {
  if (session) writeSessionJSON(SESSION_KEY, session);
  else clearSessionStorage();
}

// ---------------------------------------------------------------------
// Operator windows ("Navbat" / "Tarix"). Phone numbers are full for every
// role (decision 2026-11-22); screens only see what the adapter hands them.
// ---------------------------------------------------------------------

export type QueueReason = "login_issue" | "info_needed" | "complaint";
export type QueueStatus = "waiting" | "in_progress" | "done" | "rejected";
export type QueueItem = {
  id: string;
  /** Full number (decision 2026-11-22: no masking in admin). */
  phone: string;
  reason: QueueReason;
  waitingSinceAt: number;
  status: QueueStatus;
  assignedOperatorId?: string;
  assignedOperatorName?: string;
  /** Set when startTask() moves this to "in_progress" — the supervisor
   * view's running timer counts from this, not from the client's clock. */
  startedAt?: number;
};

export type HistoryResult = "resolved" | "callback" | "rejected";
export type HistoryEntry = {
  id: string;
  queueItemId: string;
  operatorId: string;
  operatorName: string;
  phone: string;
  reason: QueueReason;
  result: HistoryResult;
  note: string;
  rejectReason?: string;
  createdAt: number;
  resolvedAt: number;
  edited: boolean;
};

/** Sample number only: the "003" block keeps it obviously fake. The
 * discarded draw keeps the seeded sequence (and the sample data) stable. */
function randomPhone(rng: ReturnType<typeof makeRng>): string {
  const op = rng.int(0, 9);
  rng.int(100, 999);
  return `+998 9${op} 003 ${rng.int(10, 99)} ${rng.int(10, 99)}`;
}

function seedOperatorWindows(): { queue: QueueItem[]; history: HistoryEntry[] } {
  const rng = makeRng(90_210);
  const reasons: QueueReason[] = ["login_issue", "info_needed", "complaint"];
  const now = Date.now();
  const dayMs = 86_400_000;
  const operators = [
    { id: "adm_05", name: "Dilnoza Qosimova" },
    { id: "adm_07", name: "Sevinch Yo'ldasheva" },
  ];

  const waiting: QueueItem[] = Array.from({ length: 6 }, (_, i) => {
    const full = randomPhone(rng);
    return {
      id: `q_${i + 1}`,
      phone: full,
      reason: rng.pick(reasons),
      waitingSinceAt: now - rng.int(1, 45) * 60_000,
      status: "waiting" as const,
    };
  });

  // One active ("Jarayonda") task per operator, so the supervisor view and
  // the operator's own "one active task" state aren't both empty on first load.
  const inProgress: QueueItem[] = operators.map((op, i) => {
    const full = randomPhone(rng);
    const startedAt = now - rng.int(1, 8) * 60_000;
    return {
      id: `q_active_${i + 1}`,
      phone: full,
      reason: rng.pick(reasons),
      waitingSinceAt: startedAt - rng.int(2, 10) * 60_000,
      status: "in_progress" as const,
      assignedOperatorId: op.id,
      assignedOperatorName: op.name,
      startedAt,
    };
  });

  const results: HistoryResult[] = ["resolved", "resolved", "resolved", "callback", "rejected"];
  // Most history resolved today, so "Bugungi tasdiqlanganlar" isn't empty by
  // default; the rest spread over the past month so date/result filters have
  // something to narrow down.
  const history: HistoryEntry[] = Array.from({ length: 20 }, (_, i) => {
    const op = rng.pick(operators);
    const full = randomPhone(rng);
    const result = rng.pick(results);
    const resolvedAt = i < 9 ? now - rng.int(0, 7 * 3600_000) : now - rng.int(1, 29) * dayMs;
    return {
      id: `h_${i + 1}`,
      queueItemId: `qh_${i + 1}`,
      operatorId: op.id,
      operatorName: op.name,
      phone: full,
      reason: rng.pick(reasons),
      result,
      note: result === "rejected" ? "Mijoz javob bermadi" : "Muammo hal qilindi, mijozga tushuntirildi.",
      rejectReason: result === "rejected" ? "Mijoz javob bermadi" : undefined,
      createdAt: resolvedAt - 5 * 60_000,
      resolvedAt,
      edited: false,
    };
  });

  return { queue: [...waiting, ...inProgress], history };
}

const QUEUE_KEY = "operator_queue";
const HISTORY_KEY = "operator_history";
const OPERATOR_SCHEMA_KEY = "operator_windows_version";
const OPERATOR_SCHEMA_VERSION = 3;

export function getQueue(): QueueItem[] {
  const version = readJSON<number>(OPERATOR_SCHEMA_KEY, 0);
  const existing = version === OPERATOR_SCHEMA_VERSION ? readJSON<QueueItem[] | null>(QUEUE_KEY, null) : null;
  if (existing) return existing;
  const { queue, history } = seedOperatorWindows();
  writeJSON(QUEUE_KEY, queue);
  writeJSON(HISTORY_KEY, history);
  writeJSON(OPERATOR_SCHEMA_KEY, OPERATOR_SCHEMA_VERSION);
  return queue;
}
export function saveQueue(list: QueueItem[]) {
  writeJSON(QUEUE_KEY, list);
}
export function getHistory(): HistoryEntry[] {
  getQueue(); // reseeds both together if the version doesn't match
  return readJSON<HistoryEntry[]>(HISTORY_KEY, []);
}
export function saveHistory(list: HistoryEntry[]) {
  writeJSON(HISTORY_KEY, list);
}
