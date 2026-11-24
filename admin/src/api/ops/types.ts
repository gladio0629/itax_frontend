// Operator order page and "Menejerga so'rov" (2026-11-24, doc 2.5
// "Operator huquqlari"). Everything here is server data: statuses, money,
// counts and which buttons appear (allowedActions). Screens only display it.
import type { CargoBodySize, HistoryResult, ListCounts, OrderKind, OrderStatus } from "../types";

// ------------------------------------------------------------ order page

/** Buttons on the operator order page; shown only when listed by the server. */
export type OpOrderAction = "call_passenger" | "call_driver" | "restart_search" | "cancel" | "manager_request";

export type OpOrderStep = {
  title: string;
  detail: string | null;
  /** Moment (or start of a span); null = not yet / "hozir" for the current step. */
  at: number | null;
  /** End of a span ("14:52–14:53"). */
  until?: number | null;
  /** Server estimate ("~19:40"). */
  estimated?: boolean;
  state: "done" | "current" | "pending";
};

export type OpOrderPerson = { id: string | null; name: string; phone: string };

export type OpOrderStop = {
  /** pickup = olish (yuk olish), stop = oraliq to'xtash, dropoff = borish / N-tushirish. */
  kind: "pickup" | "stop" | "dropoff";
  address: string;
  /** Pickup time promised to the passenger. */
  promisedAt?: number | null;
  /** Delivery: the sender at pickup, the recipient at a drop-off. */
  contact?: { role: "sender" | "recipient"; name: string; phone: string } | null;
  state: "done" | "active" | "pending";
  /** Server status text: "15:34 da olindi", "Oldinda", "~19:40", "Kutilmoqda". */
  stateText: string;
};

export type OpOrderPriceLine = { label: string; amount: number; kind: "base" | "extra" | "discount" };

export type OpPaymentStatus = "held" | "pending" | "paid" | "refunded" | "failed";
export type OpPayment = {
  /** Server label: "Payme", "Click", "Karta", "Naqd". */
  method: string;
  methodKind: "card" | "wallet" | "cash";
  /** Transaction ID (with card mask when the server sends it). */
  ref: string | null;
  amount: number;
  status: OpPaymentStatus;
};

export type OpOrderCargo = {
  bodySize: CargoBodySize;
  /** "260×155×150 sm" */
  bodyDims: string | null;
  maxKg: number | null;
  items: string | null;
  loaders: number;
  pricing: "route" | "hourly";
  companion: boolean;
  /** Server text, e.g. "5 mln so'mgacha"; null = no insurance. */
  insurance: string | null;
  note: string | null;
};

export type OpOrderDetail = {
  id: string;
  kind: OrderKind;
  status: OrderStatus;
  createdAt: number;
  fromCity: string;
  toCity: string;
  /** Passenger order: seats and class; delivery: see cargo. */
  seats: number | null;
  carClassLabel: string | null;
  paymentLabel: string;
  /** Passenger, or the sender of a delivery. */
  customer: OpOrderPerson;
  driver: (OpOrderPerson & { plate: string | null }) | null;
  recipients: OpOrderPerson[];
  timeline: OpOrderStep[];
  stops: OpOrderStop[];
  lastLocation: { text: string; at: number; speedKmh: number | null } | null;
  /** "Haydovchilarga ko'rsatilishi"; null = the server does not report it. */
  dispatch: { shown: number; declined: number; noAnswer: number; acceptedBy: string | null; acceptedInSec: number | null } | null;
  price: { quoted: number; lines: OpOrderPriceLine[]; final: number | null };
  payments: OpPayment[];
  cargo: OpOrderCargo | null;
  allowedActions: OpOrderAction[];
};

/** OpCancel reasons (design). The server validates them. */
export type OpCancelReason = "passenger_asked" | "driver_asked" | "driver_no_show" | "passenger_no_show" | "technical" | "other";

// ------------------------------------------------------- manager requests

export type RequestSubjectKind = "passenger" | "driver" | "order";
export type ManagerRequestType =
  | "refund"
  | "compensation"
  | "penalty_cancel"
  | "ledger_fix"
  | "block"
  | "unblock"
  | "phone_change"
  | "deletion_cancel";
export type ManagerRequestStatus = "pending" | "approved" | "rejected";

/** What the "Menejerga so'rov" form offers for one subject (server). */
export type RequestForm = {
  subject: { kind: RequestSubjectKind; id: string; title: string };
  /** People the request is about, shown under the form. */
  people: { role: "passenger" | "driver" | "sender"; name: string; phone: string }[];
  types: { type: ManagerRequestType; hint: string | null; needsAmount: boolean }[];
  /** Orders the request may be linked to (optional link). */
  orders: { id: string; label: string }[];
  defaultOrderId: string | null;
};

export type ManagerRequestInput = {
  subjectKind: RequestSubjectKind;
  subjectId: string;
  type: ManagerRequestType;
  amount?: number;
  orderId?: string | null;
  reason: string;
};

export type ManagerRequest = {
  id: string;
  /** Display number: "S-118". */
  code: string;
  type: ManagerRequestType;
  status: ManagerRequestStatus;
  /** Server headline: "26 000 so'm qaytarish: Dilnoza Rahimova". */
  title: string;
  subject: { kind: "passenger" | "driver"; id: string; name: string; phone: string | null };
  order: { id: string; label: string } | null;
  amount: number | null;
  reason: string;
  createdAt: number;
  operator: { id: string; name: string };
  decision: { byName: string; at: number; reason: string | null } | null;
  /** Manager buttons; empty for the operator's own list. */
  allowedActions: ("approve" | "reject")[];
  /** Money request: "Tasdiqlash" first shows the old → new preview. */
  needsPreview: boolean;
};

export type ManagerRequestQuery = {
  /** "decided" = approved or rejected, newest decision first. */
  status?: ManagerRequestStatus | "all" | "decided";
  type?: ManagerRequestType | "all";
  operatorId?: string | "all";
  period?: "all" | "today" | "7d" | "30d";
};

/** Old → new rows of a money request, computed by the server. */
export type ManagerRequestPreview = {
  title: string;
  rows: { label: string; before: number; after: number }[];
};

/** OpMyTasks tiles and the tab counter (server). */
export type OpTasksSummary = {
  pending: number;
  approvedWeek: number;
  rejectedWeek: number;
  resolvedToday: number;
  total: number;
};

/** Operator header bell: decided requests the operator has not opened yet. */
export type OpNotifications = { unread: number };

/** One call result the operator may choose (server list, doc 2.5). */
export type CallResultOption = { result: HistoryResult; reasonRequired: boolean };

export type ManagerRequestCounts = ListCounts<ManagerRequestStatus>;
