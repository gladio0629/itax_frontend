// Mock "server" for the operator order page and manager requests
// (2026-11-24). Imported only by adapters/mock.ts, so the http build never
// contains it. It decides statuses, money, counts and allowed actions.
import { ApiError, withLatency } from "@/mockDb/latency";
import { readJSON, writeJSON } from "@/mockDb/storage";
import {
  db,
  ROLE_ACTIONS,
  ROLE_SECTIONS,
  addAuditEntry,
  getHistory as readHistory,
  getSession,
  getStaff as readStaff,
  getStaffMember,
  type AdminUser,
  type Section,
} from "@/mockDb/db";
import { makeRng } from "@/lib/prng";
import { formatNumber } from "@/lib/format";
import type { CargoBodySize, Order } from "@/seed/generate";
import type { OpsAdapter } from "../ops/adapter";
import type {
  ManagerRequest,
  ManagerRequestPreview,
  ManagerRequestQuery,
  ManagerRequestStatus,
  ManagerRequestType,
  OpCancelReason,
  OpOrderAction,
  OpOrderDetail,
  OpOrderPriceLine,
  OpOrderStep,
  OpOrderStop,
  OpPayment,
  OpTasksSummary,
  RequestForm,
  RequestSubjectKind,
} from "../ops/types";

const MIN = 60_000;
const DAY = 86_400_000;

function actor(): AdminUser {
  const s = getSession();
  if (!s) throw new ApiError("UNAUTHORIZED", "Avtorizatsiyadan o'tilmagan.");
  const u = getStaffMember(s.adminId);
  if (!u) throw new ApiError("NOT_FOUND", "Admin topilmadi");
  return u;
}
function requireAny(u: AdminUser, sections: Section[]) {
  if (!sections.some((x) => ROLE_SECTIONS[u.role].includes(x))) throw new ApiError("FORBIDDEN", "Bu bo'lim uchun ruxsatingiz yo'q.");
}
function requireWork(u: AdminUser) {
  if (!ROLE_ACTIONS[u.role].includes("operatorWork")) throw new ApiError("FORBIDDEN", "Bu amal uchun ruxsatingiz yo'q.");
}

const hash = (s: string) => {
  let h = 0;
  for (const c of s) h = (h * 31 + c.charCodeAt(0)) >>> 0;
  return h;
};
const hhmm = (ts: number) => {
  const d = new Date(ts);
  return `${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
const orderNo = (id: string) => `#${id.startsWith("ord_") ? id.slice(4) : id.slice(0, 8)}`;
const cityName = (id: string) => db.cities().find((c) => c.id === id)?.name ?? id;
const orderLabel = (o: Order) => `${orderNo(o.id)} · ${cityName(o.fromCityId)} → ${cityName(o.toCityId)}`;

// ------------------------------------------------------------ order page

const BODY: Record<CargoBodySize, { dims: string; kg: number }> = {
  S: { dims: "170×110×100 sm", kg: 300 },
  M: { dims: "260×155×150 sm", kg: 700 },
  L: { dims: "310×180×180 sm", kg: 1500 },
  XL: { dims: "420×200×200 sm", kg: 3000 },
  XXL: { dims: "620×240×240 sm", kg: 5000 },
  "3XL": { dims: "1360×245×270 sm", kg: 20000 },
};
const CARGO_ITEMS = ["Divan, kir yuvish mashinasi", "Muzlatkich", "10 ta quti, ofis jihozlari", "Qurilish materiallari", "Shkaf va 2 ta stol"];
const LOADER_FEE = 30_000;
const STOP_FEE = 10_000;
const CANCEL_LABEL: Record<OpCancelReason, string> = {
  passenger_asked: "Yo'lovchi so'radi",
  driver_asked: "Haydovchi so'radi",
  driver_no_show: "Haydovchi kelmadi",
  passenger_no_show: "Yo'lovchi chiqmadi",
  technical: "Texnik xato",
  other: "Boshqa sabab",
};

function orderActions(o: Order): OpOrderAction[] {
  const a: OpOrderAction[] = ["call_passenger"];
  if (o.driverId) a.push("call_driver");
  if (o.status === "searching" || o.status === "no_driver") a.push("restart_search");
  if (o.status === "searching" || o.status === "accepted" || o.status === "in_progress") a.push("cancel");
  a.push("manager_request");
  return a;
}

function buildOpOrder(o: Order): OpOrderDetail {
  const rng = makeRng(hash(o.id));
  const passenger = db.getPassenger(o.passengerId);
  const driver = o.driverId ? db.getDriver(o.driverId) : undefined;
  const from = cityName(o.fromCityId);
  const to = cityName(o.toCityId);
  const isCargo = o.kind === "delivery";
  const others = db.cities().filter((c) => c.id !== o.fromCityId && c.id !== o.toCityId);
  const mid = rng.pick(others)?.name ?? from;

  // Payment (server labels).
  const card = o.paymentMethod === "card";
  const provider = card ? rng.pick(["Payme", "Click", "Karta"] as const) : "Naqd";
  const refBase = `${provider === "Payme" ? "PM" : provider === "Click" ? "CL" : "CR"}-${rng.int(1000, 9999)}`;

  // Dispatch numbers.
  const shown = rng.int(5, 18);
  const declined = Math.min(shown - 1, rng.int(0, 4));
  const acceptSec = rng.int(12, 95);
  const accepted = !!driver && o.status !== "searching" && o.status !== "no_driver";
  const dispatch = {
    shown,
    declined,
    noAnswer: Math.max(0, shown - declined - (accepted ? 1 : 0)),
    acceptedBy: accepted ? driver!.name : null,
    acceptedInSec: accepted ? acceptSec : null,
  };

  // Times.
  const t0 = o.createdAt;
  const tAccept = t0 + acceptSec * 1000;
  const promised = t0 + 36 * MIN;
  const late = rng.int(0, 9);
  const tArrive = promised + late * MIN;
  const waitSec = isCargo ? rng.int(4, 14) * 60 : rng.int(60, 290);
  const tPicked = tArrive + waitSec * 1000;
  const tEnd = tPicked + (o.durationMin ?? 120) * MIN;
  const picked = o.status === "in_progress" || o.status === "completed";
  const done = o.status === "completed";
  const kmLeft = rng.int(40, 260);

  // Stops.
  const hasStop = !isCargo && rng.bool(0.45);
  const recipients = isCargo
    ? db
        .passengers()
        .filter((p) => p.id !== o.passengerId)
        .slice(hash(o.id) % 20, (hash(o.id) % 20) + rng.int(1, 2))
        .map((p) => ({ id: null, name: p.name, phone: p.phone }))
    : [];
  const stops: OpOrderStop[] = [];
  const closed = o.status === "cancelled" || o.status === "no_driver";
  const pending = (text = "Kutilmoqda"): Pick<OpOrderStop, "state" | "stateText"> => ({ state: "pending", stateText: closed ? "—" : text });
  stops.push({
    kind: "pickup",
    address: o.pickupAddress ?? `${from}, markaz`,
    promisedAt: isCargo ? null : promised,
    contact: isCargo && passenger ? { role: "sender", name: passenger.name, phone: passenger.phone } : null,
    ...(picked ? { state: "done", stateText: `${hhmm(tPicked)} da olindi` } : o.status === "accepted" ? { state: "active", stateText: "Haydovchi yo'lda" } : pending()),
  });
  if (hasStop)
    stops.push({
      kind: "stop",
      address: `${mid}, avtovokzal`,
      ...(done ? { state: "done", stateText: "O'tildi" } : picked ? { state: "active", stateText: "Oldinda" } : pending()),
    });
  if (isCargo) {
    const drops = Math.max(1, recipients.length);
    for (let i = 0; i < drops; i++) {
      const r = recipients[i];
      stops.push({
        kind: "dropoff",
        address: i === drops - 1 ? o.dropoffAddress ?? `${to}, markaz` : `${mid}, ${rng.pick(["Sharof Rashidov 5", "Mustaqillik 12", "Navoiy 41"])}`,
        contact: r ? { role: "recipient", name: r.name, phone: r.phone } : null,
        ...(done ? { state: "done", stateText: `${hhmm(tEnd)} da topshirildi` } : picked && i === 0 ? { state: "active", stateText: "Yo'lda" } : pending()),
      });
    }
  } else {
    stops.push({
      kind: "dropoff",
      address: o.dropoffAddress ?? `${to}, markaz`,
      ...(done ? { state: "done", stateText: `${hhmm(tEnd)} da yetib keldi` } : picked ? { state: "pending", stateText: `~${hhmm(tEnd)}` } : pending()),
    });
  }

  // Timeline.
  const source = o.createdByAdminId ? "Admin panelidan" : "Yo'lovchi ilovasidan";
  const steps: OpOrderStep[] = [{ title: "Yaratildi", detail: `${source} · ${provider}`, at: t0, state: "done" }];
  const shownText = `${shown} haydovchiga ko'rsatildi${isCargo && o.bodySize ? ` (kuzov ${o.bodySize} va undan katta)` : ""}`;
  if (o.status === "searching") {
    steps.push({ title: "Qidirilmoqda", detail: shownText, at: null, state: "current" });
  } else if (o.status === "no_driver") {
    steps.push({ title: "Haydovchi topilmadi", detail: `${shownText}, hech kim qabul qilmadi`, at: t0, until: t0 + 5 * MIN, state: "done" });
  } else {
    if (driver) {
      steps.push({ title: "Qidirildi", detail: declined ? `${shownText}, ${declined} tasi rad etdi` : shownText, at: t0, until: tAccept, state: "done" });
      steps.push({ title: "Qabul qilindi", detail: `${driver.name}, ${acceptSec} soniyada`, at: tAccept, state: "done" });
    }
    if (o.status === "cancelled") {
      const by = o.cancelledBy === "driver" ? "Haydovchi" : o.cancelledBy === "admin" ? "Xodim" : "Yo'lovchi";
      steps.push({ title: "Bekor qilindi", detail: `${by}${o.cancelReason ? `: ${o.cancelReason}` : " bekor qildi"}`, at: t0 + 12 * MIN, state: "done" });
    } else if (o.status === "accepted") {
      steps.push({ title: "Yo'lda", detail: isCargo ? "Yuk olish nuqtasiga" : "Olish nuqtasiga kelmoqda", at: null, state: "current" });
    } else {
      steps.push({
        title: "Yetib keldi",
        detail: isCargo ? "Yuk olish nuqtasiga" : late ? `Olish nuqtasiga, va'dadan ${late} daqiqa kech` : "Olish nuqtasiga, vaqtida",
        at: tArrive,
        state: "done",
      });
      const paidWait = isCargo ? Math.max(0, Math.round(waitSec / 60) - 5) : 0;
      steps.push(
        isCargo
          ? { title: "Yuk ortildi", detail: `Kutish ${Math.round(waitSec / 60)} daqiqa${paidWait ? `: ${paidWait} daqiqa pullik` : ""}`, at: tPicked, state: "done" }
          : { title: "Kutildi", detail: `${Math.floor(waitSec / 60)} daqiqa ${waitSec % 60} soniya: bepul vaqt ichida`, at: tArrive, until: tPicked, state: "done" }
      );
      if (o.status === "in_progress") {
        steps.push({ title: isCargo ? "Yo'lda" : "Safarda", detail: isCargo ? "1-tushirish nuqtasi tomon" : `${mid} yaqinida, ${kmLeft} km qoldi`, at: null, state: "current" });
        if (!isCargo) steps.push({ title: "Tugaydi", detail: "Taxminan", at: tEnd, estimated: true, state: "pending" });
      } else {
        steps.push({ title: "Tugadi", detail: isCargo ? "Yuk topshirildi" : "Yo'lovchi manzilga yetdi", at: tEnd, state: "done" });
      }
    }
  }

  // Price lines.
  const loaders = isCargo ? rng.int(0, 2) : 0;
  const lines: OpOrderPriceLine[] = [{ label: "Yo'l haqi", amount: o.price - loaders * LOADER_FEE, kind: "base" }];
  if (!isCargo && picked) lines.push({ label: "Kutish (bepul vaqt ichida)", amount: 0, kind: "extra" });
  if (hasStop) lines.push({ label: "Oraliq to'xtash", amount: STOP_FEE, kind: "extra" });
  if (loaders) lines.push({ label: "Yukchi", amount: loaders * LOADER_FEE, kind: "extra" });
  const paidWaitMin = isCargo && picked ? Math.max(0, Math.round(waitSec / 60) - 5) : 0;
  if (paidWaitMin) lines.push({ label: `Pullik kutish, ${paidWaitMin} daqiqa`, amount: paidWaitMin * 500, kind: "extra" });
  const total = lines.reduce((s, l) => s + (l.kind === "discount" ? -l.amount : l.amount), 0);

  const payStatus: OpPayment["status"] = o.status === "completed" ? "paid" : o.status === "cancelled" || o.status === "no_driver" ? "refunded" : card ? "held" : "pending";
  const payments: OpPayment[] = [
    { method: provider, methodKind: card ? (provider === "Karta" ? "card" : "wallet") : "cash", ref: card ? `${refBase}-${String(rng.int(1, 99)).padStart(4, "0")}${provider === "Karta" ? ` · •••• ${rng.int(1000, 9999)}` : ""}` : null, amount: o.price, status: payStatus },
  ];
  if (card && total > o.price && !closed)
    payments.push({ method: provider, methodKind: provider === "Karta" ? "card" : "wallet", ref: `${refBase}-${String(rng.int(100, 999)).padStart(4, "0")}`, amount: total - o.price, status: done ? "paid" : "pending" });

  return {
    id: o.id,
    kind: o.kind,
    status: o.status,
    createdAt: o.createdAt,
    fromCity: from,
    toCity: to,
    seats: isCargo ? null : o.mode === "car" ? driver?.seats ?? 4 : o.seatIds.length,
    carClassLabel: isCargo ? null : "Standart",
    paymentLabel: provider,
    customer: { id: passenger?.id ?? null, name: passenger?.name ?? "—", phone: passenger?.phone ?? "" },
    driver: driver ? { id: driver.id, name: driver.name, phone: driver.phone, plate: driver.plate } : null,
    recipients,
    timeline: steps,
    stops,
    lastLocation:
      driver && (o.status === "accepted" || o.status === "in_progress")
        ? { text: o.status === "accepted" ? `${from}, olish nuqtasidan ${rng.int(2, 9)} km` : `${mid} yaqinida`, at: Date.now() - 2 * MIN, speedKmh: rng.int(30, 90) }
        : null,
    dispatch: isCargo ? null : dispatch,
    price: { quoted: o.price, lines, final: closed ? null : total },
    payments,
    cargo: isCargo
      ? {
          bodySize: o.bodySize ?? "M",
          bodyDims: BODY[o.bodySize ?? "M"].dims,
          maxKg: BODY[o.bodySize ?? "M"].kg,
          items: rng.pick(CARGO_ITEMS),
          loaders,
          pricing: "route",
          companion: rng.bool(0.25),
          insurance: rng.bool(0.5) ? "5 mln so'mgacha" : null,
          note: rng.bool(0.6) ? "Qadoqlangan. 3-qavat, lift bor. Kirishda qo'ng'iroq qiling." : null,
        }
      : null,
    allowedActions: orderActions(o),
  };
}

function findOrder(id: string): Order {
  const o = db.getOrder(id);
  if (!o) throw new ApiError("ORDER_NOT_FOUND", "Buyurtma topilmadi.");
  return o;
}

// ------------------------------------------------------- manager requests

type StoredRequest = Omit<ManagerRequest, "allowedActions" | "needsPreview" | "title" | "subject" | "order"> & {
  subjectKind: "passenger" | "driver";
  subjectId: string;
  orderId: string | null;
  /** Number behind the "S-" code. */
  no: number;
};

const REQUESTS_KEY = "op_requests_v1";
const MONEY: ManagerRequestType[] = ["refund", "compensation", "ledger_fix", "penalty_cancel"];
const TYPE_HINT: Partial<Record<ManagerRequestType, string>> = {
  refund: "yo'lovchiga",
  compensation: "bonus yoki promo",
  ledger_fix: "haydovchi hamyoni",
  penalty_cancel: "haydovchiga",
};

function seedRequests(): StoredRequest[] {
  const staff = readStaff();
  // Samples belong to the signed-in operator when an operator seeds them
  // (the demo login), else to the first active operator.
  const me = getSession() ? getStaffMember(getSession()!.adminId) : undefined;
  const ops = staff.filter((u) => u.role === "operator" && !u.archived && u.status === "active");
  if (me?.role === "operator") ops.sort((a, b) => (a.id === me.id ? -1 : b.id === me.id ? 1 : 0));
  const mgr = staff.find((u) => u.role === "menejer" && !u.archived) ?? staff[0];
  const op1 = ops[0] ?? staff[0];
  const op2 = ops[1] ?? op1;
  const done = db.orders().filter((o) => o.status === "completed" && o.driverId);
  const ps = db.passengers().filter((p) => !p.archived);
  const ds = db.drivers().filter((d) => !d.archived);
  const now = Date.now();
  const today = new Date(now).setHours(0, 0, 0, 0);
  const o1 = done[0];
  const o2 = done[3] ?? done[0];
  const p1 = db.getPassenger(o1.passengerId)!;
  const p2 = db.getPassenger(o2.passengerId)!;
  const base = (no: number, partial: Partial<StoredRequest> & Pick<StoredRequest, "type" | "subjectKind" | "subjectId" | "reason" | "createdAt">): StoredRequest => ({
    id: `req_${no}`,
    no,
    code: `S-${no}`,
    status: "pending",
    amount: null,
    orderId: null,
    operator: { id: op1.id, name: op1.name },
    decision: null,
    ...partial,
  });
  return [
    base(118, { type: "refund", subjectKind: "passenger", subjectId: p1.id, orderId: o1.id, amount: 26_000, reason: "Haydovchi 40 daqiqa kech qoldi. Yo'lovchi safar narxining 10% qaytarilishini so'radi.", createdAt: Math.max(today, now - 40 * MIN) }),
    base(119, { type: "block", subjectKind: "passenger", subjectId: ps[7].id, operator: { id: op2.id, name: op2.name }, reason: "Haydovchiga qo'pol muomala, 2 ta shikoyat. Yozuvlar ilova qilingan.", createdAt: Math.max(today, now - 80 * MIN) }),
    base(120, { type: "compensation", subjectKind: "passenger", subjectId: p2.id, orderId: o2.id, amount: 15_000, reason: "Haydovchi oxirgi daqiqada bekor qildi, yo'lovchi avtobusga kechikdi.", createdAt: Math.max(today, now - 120 * MIN) }),
    base(117, { type: "phone_change", subjectKind: "passenger", subjectId: ps[3].id, status: "approved", reason: "Eski raqam yo'qolgan, yangi raqam: +998 90 000 00 44. Pasport bilan tasdiqlandi.", createdAt: now - 4 * 60 * MIN, decision: { byName: mgr.name, at: now - 3 * 60 * MIN, reason: null } }),
    base(112, { type: "compensation", subjectKind: "passenger", subjectId: ps[5].id, orderId: done[5]?.id ?? null, amount: 15_000, status: "rejected", reason: "Haydovchi bekor qildi, yo'lovchi uzoq kutdi.", createdAt: now - 3 * DAY, decision: { byName: mgr.name, at: now - 3 * DAY + 60 * MIN, reason: "Jarima allaqachon yechilgan, yo'lovchiga 15 000 bonus o'rniga keyingi safarda promo kod berilsin." } }),
    base(109, { type: "block", subjectKind: "driver", subjectId: ds[4].id, operator: { id: op2.id, name: op2.name }, status: "approved", reason: "Hujjatlari muddati o'tgan, yo'lovchilardan 3 ta shikoyat.", createdAt: now - 4 * DAY, decision: { byName: mgr.name, at: now - 4 * DAY + 45 * MIN, reason: null } }),
  ];
}

function readRequests(): StoredRequest[] {
  const stored = readJSON<StoredRequest[] | null>(REQUESTS_KEY, null);
  if (stored) return stored;
  const seeded = seedRequests();
  writeJSON(REQUESTS_KEY, seeded);
  return seeded;
}
const saveRequests = (rows: StoredRequest[]) => writeJSON(REQUESTS_KEY, rows);

function subjectOf(r: Pick<StoredRequest, "subjectKind" | "subjectId">) {
  if (r.subjectKind === "driver") {
    const d = db.getDriver(r.subjectId);
    return { kind: "driver" as const, id: r.subjectId, name: d?.name ?? "—", phone: d?.phone ?? null };
  }
  const p = db.getPassenger(r.subjectId);
  return { kind: "passenger" as const, id: r.subjectId, name: p?.name ?? "—", phone: p?.phone ?? null };
}

function titleOf(r: StoredRequest, name: string): string {
  const sum = r.amount !== null ? `${formatNumber(r.amount)} so'm` : "";
  const who = r.subjectKind === "driver" ? "Haydovchi" : "Yo'lovchi";
  switch (r.type) {
    case "refund":
      return `${sum} qaytarish: ${name}`;
    case "compensation":
      return `${sum} kompensatsiya: ${name}`;
    case "penalty_cancel":
      return `${sum} jarimani bekor qilish: ${name}`;
    case "ledger_fix":
      return `${sum} daftar tuzatish: ${name}`;
    case "block":
      return `${who}ni bloklash: ${name}`;
    case "unblock":
      return `${who}ni blokdan chiqarish: ${name}`;
    case "data_change":
      return `Ma'lumotni o'zgartirish: ${name}`;
    case "phone_change":
      return `Telefon raqamini almashtirish: ${name}`;
    case "deletion_cancel":
      return `O'chirish so'rovini bekor qilish: ${name}`;
  }
}

function present(r: StoredRequest, forManager: boolean): ManagerRequest {
  const subject = subjectOf(r);
  const o = r.orderId ? db.getOrder(r.orderId) : undefined;
  return {
    id: r.id,
    code: r.code,
    type: r.type,
    status: r.status,
    title: titleOf(r, subject.name),
    subject,
    order: o ? { id: o.id, label: orderNo(o.id) } : null,
    amount: r.amount,
    reason: r.reason,
    createdAt: r.createdAt,
    operator: r.operator,
    decision: r.decision,
    allowedActions: forManager && r.status === "pending" ? ["approve", "reject"] : [],
    needsPreview: MONEY.includes(r.type),
  };
}

function matchesQuery(r: StoredRequest, q: Omit<ManagerRequestQuery, "status">): boolean {
  if (q.type && q.type !== "all" && r.type !== q.type) return false;
  if (q.operatorId && q.operatorId !== "all" && r.operator.id !== q.operatorId) return false;
  if (q.period && q.period !== "all") {
    const start = q.period === "today" ? new Date().setHours(0, 0, 0, 0) : Date.now() - (q.period === "7d" ? 7 : 30) * DAY;
    if (r.createdAt < start) return false;
  }
  return true;
}

function statusMatches(r: StoredRequest, status: ManagerRequestQuery["status"]): boolean {
  if (!status || status === "all") return true;
  if (status === "decided") return r.status !== "pending";
  return r.status === status;
}

/** Does this passenger have an open account deletion request? (sample) */
const hasDeletionRequest = (passengerId: string) => hash(passengerId) % 4 === 0;

function formFor(kind: RequestSubjectKind, id: string): RequestForm {
  const types: RequestForm["types"] = [];
  const add = (type: ManagerRequestType) => types.push({ type, hint: TYPE_HINT[type] ?? null, needsAmount: MONEY.includes(type) });
  const people: RequestForm["people"] = [];
  let orders: Order[] = [];
  let title = "";
  let defaultOrderId: string | null = null;

  if (kind === "order") {
    const o = findOrder(id);
    const p = db.getPassenger(o.passengerId);
    const d = o.driverId ? db.getDriver(o.driverId) : undefined;
    title = orderLabel(o);
    if (p) people.push({ role: o.kind === "delivery" ? "sender" : "passenger", name: p.name, phone: p.phone });
    if (d) people.push({ role: "driver", name: d.name, phone: d.phone });
    add("refund");
    add("compensation");
    if (d) add("ledger_fix");
    if (d) add("penalty_cancel");
    add(p?.status === "blocked" ? "unblock" : "block");
    add("data_change");
    add("phone_change");
    orders = [o];
    defaultOrderId = o.id;
  } else if (kind === "passenger") {
    const p = db.getPassenger(id);
    if (!p) throw new ApiError("NOT_FOUND", "Yo'lovchi topilmadi.");
    title = p.name;
    people.push({ role: "passenger", name: p.name, phone: p.phone });
    add("refund");
    add("compensation");
    add(p.status === "blocked" ? "unblock" : "block");
    add("data_change");
    add("phone_change");
    if (hasDeletionRequest(p.id)) add("deletion_cancel");
    orders = db.orders().filter((o) => o.passengerId === p.id);
  } else {
    const d = db.getDriver(id);
    if (!d) throw new ApiError("NOT_FOUND", "Haydovchi topilmadi.");
    title = d.name;
    people.push({ role: "driver", name: d.name, phone: d.phone });
    add("ledger_fix");
    add("penalty_cancel");
    add(d.status === "blocked" ? "unblock" : "block");
    add("data_change");
    add("phone_change");
    orders = db.orders().filter((o) => o.driverId === d.id);
  }
  orders = [...orders].sort((a, b) => b.createdAt - a.createdAt).slice(0, 10);
  return { subject: { kind, id, title }, people, types, orders: orders.map((o) => ({ id: o.id, label: orderLabel(o) })), defaultOrderId };
}

/** Pending requests for the sidebar badge (mock.ts getSectionBadges). */
export function pendingRequestCount(): number {
  return readRequests().filter((r) => r.status === "pending").length;
}

const DRIVER_TYPES: ManagerRequestType[] = ["ledger_fix", "penalty_cancel"];

function previewOf(r: StoredRequest): ManagerRequestPreview {
  const s = subjectOf(r);
  const amount = r.amount ?? 0;
  const o = r.orderId ? db.getOrder(r.orderId) : undefined;
  const title = `${r.code}: ${TYPE_TITLE[r.type]}ni tasdiqlash`;
  const rows: ManagerRequestPreview["rows"] = [];
  if (r.type === "refund") {
    const pay = o ? buildOpOrder(o).payments[0] : null;
    rows.push({ label: `Yo'lovchiga qaytarildi${pay ? ` (${pay.method}${pay.ref ? ` ${pay.ref}` : ""})` : ""}`, before: 0, after: amount });
    if (o) {
      const finalPrice = buildOpOrder(o).price.final ?? o.price;
      rows.push({ label: `Buyurtma ${orderNo(o.id)} yakuniy narxi`, before: finalPrice, after: finalPrice - amount });
      const d = o.driverId ? db.getDriver(o.driverId) : undefined;
      if (d) {
        const back = Math.round((amount * (d.commissionPct ?? 0)) / 100);
        rows.push({ label: `${d.name} hamyoni (komissiya qayta hisoblanadi)`, before: d.walletBalance, after: d.walletBalance + back });
      }
    }
  } else if (r.type === "compensation") {
    const bonus = (hash(s.id) % 8) * 5_000;
    rows.push({ label: `${s.name}: bonus balansi`, before: bonus, after: bonus + amount });
  } else {
    const d = s.kind === "driver" ? db.getDriver(s.id) : o?.driverId ? db.getDriver(o.driverId) : undefined;
    if (d) rows.push({ label: `${d.name} hamyoni`, before: d.walletBalance, after: d.walletBalance + amount });
  }
  return { title, rows };
}

const TYPE_TITLE: Record<ManagerRequestType, string> = {
  refund: "pul qaytarish",
  compensation: "kompensatsiya",
  penalty_cancel: "jarimani bekor qilish",
  ledger_fix: "daftar tuzatish",
  block: "bloklash",
  unblock: "blokdan chiqarish",
  data_change: "ma'lumotni o'zgartirish",
  phone_change: "telefon raqamini almashtirish",
  deletion_cancel: "o'chirish so'rovini bekor qilish",
};

function applyRequest(r: StoredRequest, by: AdminUser) {
  const s = subjectOf(r);
  const o = r.orderId ? db.getOrder(r.orderId) : undefined;
  const addFix = (driverId: string, amount: number, note: string) => {
    const d = db.getDriver(driverId);
    if (!d || !amount) return;
    const balanceAfter = d.walletBalance + amount;
    db.addWalletEntry({
      id: `wal_req_${r.no}_${Date.now().toString(36)}`,
      driverId,
      type: "adjustment",
      amount,
      reason: note,
      note,
      orderId: o?.id,
      createdByAdminId: by.id,
      createdByAdminName: by.name,
      createdAt: Date.now(),
      balanceAfter,
    });
    db.updateDriver(driverId, { walletBalance: balanceAfter, atDebtLimit: balanceAfter <= d.debtLimit });
  };
  if (r.type === "block" || r.type === "unblock") {
    const status = r.type === "block" ? "blocked" : "active";
    if (s.kind === "driver") db.updateDriver(s.id, { status });
    else db.updatePassenger(s.id, { status });
  } else if (DRIVER_TYPES.includes(r.type)) {
    const driverId = s.kind === "driver" ? s.id : o?.driverId;
    if (driverId) addFix(driverId, r.amount ?? 0, `${r.code}: ${TYPE_TITLE[r.type]}`);
  } else if (r.type === "refund" && o?.driverId) {
    const d = db.getDriver(o.driverId);
    if (d) addFix(d.id, Math.round(((r.amount ?? 0) * (d.commissionPct ?? 0)) / 100), `${r.code}: qaytarish, komissiya qayta hisoblandi`);
  }
}

function findRequest(id: string): { rows: StoredRequest[]; r: StoredRequest } {
  const rows = readRequests();
  const r = rows.find((x) => x.id === id);
  if (!r) throw new ApiError("NOT_FOUND", "So'rov topilmadi.");
  return { rows, r };
}

export const mockOps: OpsAdapter = {
  getOpOrder: (id) =>
    withLatency(() => {
      requireAny(actor(), ["orders", "orders_view"]);
      return buildOpOrder(findOrder(id));
    }),

  restartOrderSearch: (id) =>
    withLatency(() => {
      const u = actor();
      requireAny(u, ["orders", "orders_view"]);
      const o = findOrder(id);
      if (!orderActions(o).includes("restart_search")) throw new ApiError("FORBIDDEN", "Bu buyurtmada qidiruvni qayta boshlab bo'lmaydi.");
      db.updateOrder(id, { status: "searching", driverId: null });
      addAuditEntry({ actorId: u.id, actorName: u.name, action: "order_restart_search", targetType: "order", targetId: id, detail: `${orderNo(id)}: qidiruv qayta boshlandi` });
      return buildOpOrder(findOrder(id));
    }),

  opCancelOrder: (id, reason, comment) =>
    withLatency(() => {
      const u = actor();
      requireAny(u, ["orders", "orders_view"]);
      const o = findOrder(id);
      if (!orderActions(o).includes("cancel")) throw new ApiError("FORBIDDEN", "Bu buyurtmani bekor qilib bo'lmaydi.");
      if (!CANCEL_LABEL[reason]) throw new ApiError("VALIDATION_ERROR", "Bekor qilish sababini tanlang.");
      const note = comment?.trim();
      if (note && note.length > 500) throw new ApiError("VALIDATION_ERROR", "Izoh 500 belgidan oshmasin.");
      const text = `${CANCEL_LABEL[reason]}${note ? `. ${note}` : ""}`;
      db.updateOrder(id, { status: "cancelled", cancelledBy: "admin", cancelReason: text, commission: null, driverPayout: null });
      addAuditEntry({ actorId: u.id, actorName: u.name, action: "order_cancel", targetType: "order", targetId: id, detail: `Bekor qilindi: ${text}` });
      return buildOpOrder(findOrder(id));
    }),

  getRequestForm: (kind, id) =>
    withLatency(() => {
      requireWork(actor());
      return formFor(kind, id);
    }),

  createManagerRequest: (input) =>
    withLatency(() => {
      const u = actor();
      requireWork(u);
      const form = formFor(input.subjectKind, input.subjectId);
      const opt = form.types.find((t) => t.type === input.type);
      if (!opt) throw new ApiError("VALIDATION_ERROR", "Bu so'rov turi mavjud emas.");
      const reason = input.reason.trim();
      if (reason.length < 5) throw new ApiError("VALIDATION_ERROR", "Sababni to'liqroq yozing (kamida 5 belgi).");
      if (reason.length > 1000) throw new ApiError("VALIDATION_ERROR", "Sabab 1000 belgidan oshmasin.");
      if (opt.needsAmount && (!Number.isInteger(input.amount) || (input.amount ?? 0) <= 0)) throw new ApiError("VALIDATION_ERROR", "Summani kiriting.");
      if (input.orderId && !form.orders.some((x) => x.id === input.orderId)) throw new ApiError("VALIDATION_ERROR", "Buyurtma topilmadi.");
      // Who the request is about: the driver for wallet types, else the customer.
      let subjectKind: "passenger" | "driver" = input.subjectKind === "driver" ? "driver" : "passenger";
      let subjectId = input.subjectId;
      if (input.subjectKind === "order") {
        const o = findOrder(input.subjectId);
        if (DRIVER_TYPES.includes(input.type) && o.driverId) {
          subjectKind = "driver";
          subjectId = o.driverId;
        } else subjectId = o.passengerId;
      }
      const rows = readRequests();
      const no = Math.max(100, ...rows.map((r) => r.no)) + 1;
      const stored: StoredRequest = {
        id: `req_${no}`,
        no,
        code: `S-${no}`,
        type: input.type,
        status: "pending",
        subjectKind,
        subjectId,
        orderId: input.orderId ?? (input.subjectKind === "order" ? input.subjectId : null),
        amount: opt.needsAmount ? input.amount ?? null : null,
        reason,
        createdAt: Date.now(),
        operator: { id: u.id, name: u.name },
        decision: null,
      };
      saveRequests([stored, ...rows]);
      addAuditEntry({ actorId: u.id, actorName: u.name, action: "request_create", targetType: "request", targetId: stored.id, detail: `${stored.code}: ${titleOf(stored, subjectOf(stored).name)}` });
      return present(stored, false);
    }),

  getMyRequests: (query) =>
    withLatency(() => {
      const u = actor();
      requireWork(u);
      return readRequests()
        .filter((r) => r.operator.id === u.id && statusMatches(r, query.status) && matchesQuery(r, query))
        .sort((a, b) => b.createdAt - a.createdAt)
        .map((r) => present(r, false));
    }),

  getMyTasksSummary: () =>
    withLatency<OpTasksSummary>(() => {
      const u = actor();
      requireWork(u);
      const mine = readRequests().filter((r) => r.operator.id === u.id);
      const weekAgo = Date.now() - 7 * DAY;
      const today = new Date().setHours(0, 0, 0, 0);
      const calls = readHistory().filter((h) => h.operatorId === u.id);
      return {
        pending: mine.filter((r) => r.status === "pending").length,
        approvedWeek: mine.filter((r) => r.status === "approved" && (r.decision?.at ?? 0) >= weekAgo).length,
        rejectedWeek: mine.filter((r) => r.status === "rejected" && (r.decision?.at ?? 0) >= weekAgo).length,
        resolvedToday: calls.filter((h) => h.resolvedAt >= today).length,
        total: mine.length + calls.length,
      };
    }),

  getManagerRequests: (query) =>
    withLatency(() => {
      requireAny(actor(), ["requests"]);
      return readRequests()
        .filter((r) => statusMatches(r, query.status) && matchesQuery(r, query))
        .sort((a, b) => (b.decision?.at ?? b.createdAt) - (a.decision?.at ?? a.createdAt))
        .map((r) => present(r, true));
    }),

  getManagerRequestCounts: (query) =>
    withLatency(() => {
      requireAny(actor(), ["requests"]);
      const rows = readRequests().filter((r) => matchesQuery(r, query));
      const counts: Partial<Record<ManagerRequestStatus | "all", number>> = { all: rows.length };
      for (const r of rows) counts[r.status] = (counts[r.status] ?? 0) + 1;
      return counts;
    }),

  getManagerRequestPreview: (id) =>
    withLatency(() => {
      requireAny(actor(), ["requests"]);
      const { r } = findRequest(id);
      if (r.status !== "pending") throw new ApiError("CONFLICT", "So'rov allaqachon ko'rib chiqilgan.");
      return previewOf(r);
    }),

  approveManagerRequest: (id) =>
    withLatency(() => {
      const u = actor();
      requireAny(u, ["requests"]);
      const { rows, r } = findRequest(id);
      if (r.status !== "pending") throw new ApiError("CONFLICT", "So'rov allaqachon ko'rib chiqilgan.");
      applyRequest(r, u);
      r.status = "approved";
      r.decision = { byName: u.name, at: Date.now(), reason: null };
      saveRequests(rows);
      addAuditEntry({ actorId: u.id, actorName: u.name, action: "request_approve", targetType: "request", targetId: r.id, detail: `${r.code} tasdiqlandi: ${titleOf(r, subjectOf(r).name)}` });
      return present(r, true);
    }),

  rejectManagerRequest: (id, reason) =>
    withLatency(() => {
      const u = actor();
      requireAny(u, ["requests"]);
      const text = reason.trim();
      if (!text) throw new ApiError("VALIDATION_ERROR", "Rad etish sababini yozing.");
      if (text.length > 1000) throw new ApiError("VALIDATION_ERROR", "Sabab 1000 belgidan oshmasin.");
      const { rows, r } = findRequest(id);
      if (r.status !== "pending") throw new ApiError("CONFLICT", "So'rov allaqachon ko'rib chiqilgan.");
      r.status = "rejected";
      r.decision = { byName: u.name, at: Date.now(), reason: text };
      saveRequests(rows);
      addAuditEntry({ actorId: u.id, actorName: u.name, action: "request_reject", targetType: "request", targetId: r.id, detail: `${r.code} rad etildi: ${text}` });
      return present(r, true);
    }),
};
