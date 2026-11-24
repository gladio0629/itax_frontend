// Real-backend calls for the operator windows (search, passengers,
// passenger and driver cards). The backend does not have these endpoints
// yet: they are described in docs/backend-gaps.md
// "## admin (operator, 2026-11-24)". The server sends snake_case JSON with
// ISO times; the small mappers below convert it.
import type { HttpClient } from "@shared/http/client";
import type { OpCardsApi } from "../opCards/adapter";
import type {
  OpBonusEntry,
  OpCardAction,
  OpNote,
  OpNoteCategory,
  OpPassengerCard,
  OpPassengerOrderRow,
  OpPassengerOrdersPage,
  OpPassengerPayments,
  OpPassengerRow,
  OpPassengersPage,
  OpPaymentRow,
  OpPaymentStatus,
  OpPaymentType,
  OpPromoCode,
  OpRequestStatus,
  OpRequestType,
  OpSearchResult,
  OpSmsInfo,
  OpSmsResult,
  OpSmsType,
  OpSubject,
  OpTimelineItem,
} from "../opCards/types";
import type { DriverStatus, OrderKind, OrderStatus, PassengerStatus, PaymentMethod } from "../types";

const ms = (iso: string | null | undefined) => (iso ? Date.parse(iso) : null);
const msReq = (iso: string) => Date.parse(iso);

type ApiPage<T> = { items: T[]; total: number; page: number; page_size: number };
const pageOf = <A, T>(p: ApiPage<A>, map: (a: A) => T) => ({ rows: p.items.map(map), total: p.total, page: p.page, pageSize: p.page_size });

type ApiSearch = {
  passengers: { id: string; name: string; phone: string; orders_count: number; status: PassengerStatus }[];
  drivers: { id: string; name: string; phone: string; car_model: string; plate: string; status: DriverStatus; at_debt_limit: boolean | null }[];
  orders: {
    id: string;
    kind: OrderKind;
    from: string;
    to: string;
    created_at: string;
    person: { role: "driver" | "passenger"; name: string } | null;
    price: number;
    status: OrderStatus;
  }[];
  counts: { passengers: number; drivers: number; orders: number };
};

type ApiPassengerRow = {
  id: string;
  name: string;
  phone: string;
  orders_count: number;
  rating: number | null;
  last_trip_at: string | null;
  status: PassengerStatus;
};
const passengerRow = (r: ApiPassengerRow): OpPassengerRow => ({
  id: r.id,
  name: r.name,
  phone: r.phone,
  ordersCount: r.orders_count,
  rating: r.rating,
  lastTripAt: ms(r.last_trip_at),
  status: r.status,
});

type ApiTimelineItem = { id: string; title: string; detail: string | null; at: string; tone: OpTimelineItem["tone"] };
const timelineItem = (t: ApiTimelineItem): OpTimelineItem => ({ id: t.id, title: t.title, detail: t.detail, at: msReq(t.at), tone: t.tone });

type ApiPassengerCard = {
  id: string;
  display_id: string;
  name: string;
  phone: string;
  status: PassengerStatus;
  joined_at: string;
  language: string | null;
  actions: OpCardAction[];
  tabs: { orders: number; payments: number; notes: number; sms_alert: boolean };
  status_note: { text: string; by_name: string; at: string } | null;
  stats: { orders: number; cancelled: number; cancelled_this_week: number; bonus_balance: number; rating: number | null };
  profile: { app: string | null; main_payment: PaymentMethod | null; saved_addresses: string[]; last_order: { id: string; created_at: string } | null };
  status_history: ApiTimelineItem[];
  deletion_request: { requested_at: string; reason: string | null; auto_delete_at: string } | null;
};
const passengerCard = (c: ApiPassengerCard): OpPassengerCard => ({
  id: c.id,
  displayId: c.display_id,
  name: c.name,
  phone: c.phone,
  status: c.status,
  joinedAt: msReq(c.joined_at),
  language: c.language,
  actions: c.actions,
  tabs: { orders: c.tabs.orders, payments: c.tabs.payments, notes: c.tabs.notes, smsAlert: c.tabs.sms_alert },
  statusNote: c.status_note && { text: c.status_note.text, byName: c.status_note.by_name, at: msReq(c.status_note.at) },
  stats: {
    orders: c.stats.orders,
    cancelled: c.stats.cancelled,
    cancelledThisWeek: c.stats.cancelled_this_week,
    bonusBalance: c.stats.bonus_balance,
    rating: c.stats.rating,
  },
  profile: {
    app: c.profile.app,
    mainPayment: c.profile.main_payment,
    savedAddresses: c.profile.saved_addresses,
    lastOrder: c.profile.last_order && { id: c.profile.last_order.id, createdAt: msReq(c.profile.last_order.created_at) },
  },
  statusHistory: c.status_history.map(timelineItem),
  deletionRequest: c.deletion_request && {
    requestedAt: msReq(c.deletion_request.requested_at),
    reason: c.deletion_request.reason,
    autoDeleteAt: msReq(c.deletion_request.auto_delete_at),
  },
});

type ApiPassengerOrderRow = {
  id: string;
  kind: OrderKind;
  from: string;
  to: string;
  created_at: string;
  driver: { name: string; phone: string } | null;
  payment: PaymentMethod;
  price: number;
  status: OrderStatus;
  cancelled_by: OpPassengerOrderRow["cancelledBy"];
};
const passengerOrderRow = (o: ApiPassengerOrderRow): OpPassengerOrderRow => ({
  id: o.id,
  kind: o.kind,
  from: o.from,
  to: o.to,
  createdAt: msReq(o.created_at),
  driver: o.driver,
  payment: o.payment,
  price: o.price,
  status: o.status,
  cancelledBy: o.cancelled_by,
});

type ApiPaymentRow = {
  id: string;
  at: string;
  type: OpPaymentType;
  order_id: string | null;
  txn_id: string | null;
  card_last4: string | null;
  amount: number;
  status: OpPaymentStatus;
};
const paymentRow = (r: ApiPaymentRow): OpPaymentRow => ({
  id: r.id,
  at: msReq(r.at),
  type: r.type,
  orderId: r.order_id,
  txnId: r.txn_id,
  cardLast4: r.card_last4,
  amount: r.amount,
  status: r.status,
});
type ApiPayments = ApiPage<ApiPaymentRow> & {
  summary: {
    paid: number;
    refunded: number;
    refund_count: number;
    tips: number;
    tip_count: number;
    failed_count: number;
    last_failed: { type: OpPaymentType; at: string } | null;
  };
  counts: OpPassengerPayments["counts"];
};

type ApiBonus = {
  balance: number;
  entries: { id: string; at: string; text: string; order_id: string | null; amount: number; balance_after: number }[];
  promos: {
    code: string;
    discount: { percent: number; max_amount: number | null } | { amount: number };
    used_at: string | null;
    valid_until: string | null;
    status: OpPromoCode["status"];
  }[];
};

type ApiSms = {
  last_at: string | null;
  last_result: OpSmsResult | null;
  attempts: { used: number; max: number };
  lock: { wrong_attempts: number; minutes: number } | null;
  actions: OpCardAction[];
  log: { id: string; at: string; type: OpSmsType; provider: string; result: OpSmsResult; limit: { used: number; max: number } | null }[];
};
const smsInfo = (r: ApiSms): OpSmsInfo => ({
  lastAt: ms(r.last_at),
  lastResult: r.last_result,
  attempts: r.attempts,
  lock: r.lock && { wrongAttempts: r.lock.wrong_attempts, minutes: r.lock.minutes },
  actions: r.actions,
  log: r.log.map((x) => ({ id: x.id, at: msReq(x.at), type: x.type, provider: x.provider, result: x.result, limit: x.limit })),
});

type ApiNote = { id: string; author_name: string; category: OpNoteCategory; text: string; at: string };
const note = (n: ApiNote): OpNote => ({ id: n.id, authorName: n.author_name, category: n.category, text: n.text, at: msReq(n.at) });
type ApiNotes = {
  notes: ApiNote[];
  requests: { id: string; display_id: string; type: OpRequestType; amount: number | null; status: OpRequestStatus }[];
  actions: OpCardAction[];
};

const OP = "/admin/v1/operator";
const subjectPath = (s: OpSubject) => `${OP}/${s.kind === "passenger" ? "passengers" : "drivers"}/${encodeURIComponent(s.id)}`;
const passengerPath = (id: string) => subjectPath({ kind: "passenger", id });

export function opCardsHttp(http: HttpClient): OpCardsApi {
  return {
    async opSearch(q) {
      const r = await http.get<ApiSearch>(`${OP}/search`, { q: q.trim() });
      const out: OpSearchResult = {
        passengers: r.passengers.map((p) => ({ id: p.id, name: p.name, phone: p.phone, ordersCount: p.orders_count, status: p.status })),
        drivers: r.drivers.map((d) => ({
          id: d.id,
          name: d.name,
          phone: d.phone,
          carModel: d.car_model,
          plate: d.plate,
          status: d.status,
          atDebtLimit: d.at_debt_limit,
        })),
        orders: r.orders.map((o) => ({
          id: o.id,
          kind: o.kind,
          from: o.from,
          to: o.to,
          createdAt: msReq(o.created_at),
          person: o.person,
          price: o.price,
          status: o.status,
        })),
        counts: r.counts,
      };
      return out;
    },

    async getOpPassengers(query) {
      const r = await http.get<ApiPage<ApiPassengerRow> & { counts: OpPassengersPage["counts"] }>(`${OP}/passengers`, {
        q: query.search?.trim() || undefined,
        status: query.status === "all" ? undefined : query.status,
        page: query.page,
      });
      return { ...pageOf(r, passengerRow), counts: r.counts };
    },

    async getOpPassenger(id) {
      return passengerCard(await http.get<ApiPassengerCard>(passengerPath(id)));
    },

    async getOpPassengerOrders(id, query) {
      const r = await http.get<ApiPage<ApiPassengerOrderRow> & { counts: OpPassengerOrdersPage["counts"] }>(`${passengerPath(id)}/orders`, {
        status: query.status === "all" ? undefined : query.status,
        period: query.period === "all" ? undefined : query.period,
        page: query.page,
      });
      return { ...pageOf(r, passengerOrderRow), counts: r.counts };
    },

    async getOpPassengerPayments(id, query) {
      const r = await http.get<ApiPayments>(`${passengerPath(id)}/payments`, { type: query.type === "all" ? undefined : query.type, page: query.page });
      const s = r.summary;
      return {
        ...pageOf(r, paymentRow),
        summary: {
          paid: s.paid,
          refunded: s.refunded,
          refundCount: s.refund_count,
          tips: s.tips,
          tipCount: s.tip_count,
          failedCount: s.failed_count,
          lastFailed: s.last_failed && { type: s.last_failed.type, at: msReq(s.last_failed.at) },
        },
        counts: r.counts,
      };
    },

    async getOpPassengerBonus(id) {
      const r = await http.get<ApiBonus>(`${passengerPath(id)}/bonus`);
      return {
        balance: r.balance,
        entries: r.entries.map((e): OpBonusEntry => ({ id: e.id, at: msReq(e.at), text: e.text, orderId: e.order_id, amount: e.amount, balanceAfter: e.balance_after })),
        promos: r.promos.map(
          (p): OpPromoCode => ({
            code: p.code,
            discount: "percent" in p.discount ? { percent: p.discount.percent, maxAmount: p.discount.max_amount } : { amount: p.discount.amount },
            usedAt: ms(p.used_at),
            validUntil: ms(p.valid_until),
            status: p.status,
          })
        ),
      };
    },

    async getOpSms(subject, period) {
      return smsInfo(await http.get<ApiSms>(`${subjectPath(subject)}/sms`, { period }));
    },
    async unlockOpSms(subject, period) {
      return smsInfo(await http.post<ApiSms>(`${subjectPath(subject)}/sms/unlock?period=${period}`));
    },
    async resendOpSmsCode(subject, period) {
      return smsInfo(await http.post<ApiSms>(`${subjectPath(subject)}/sms/resend?period=${period}`));
    },

    async getOpNotes(subject) {
      const r = await http.get<ApiNotes>(`${subjectPath(subject)}/notes`);
      return {
        notes: r.notes.map(note),
        requests: r.requests.map((q) => ({ id: q.id, displayId: q.display_id, type: q.type, amount: q.amount, status: q.status })),
        actions: r.actions,
      };
    },
    async addOpNote(subject, text) {
      return note(await http.post<ApiNote>(`${subjectPath(subject)}/notes`, { text: text.trim() }));
    },
  };
}
