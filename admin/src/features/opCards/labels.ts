import type { BadgeTone } from "@/components/Badge";
import type { PassengerStatus } from "@/api/types";
import type {
  OpNoteCategory,
  OpPaymentStatus,
  OpPaymentType,
  OpRequestStatus,
  OpRequestType,
  OpSmsResult,
  OpSmsType,
  OpSubjectKind,
} from "@/api/opCards/types";

/** Operator window routes. The app's operator prefix is /operators
 * (the route contract's /op/... tails live under it). */
export const opPath = {
  search: "/operators/search",
  passengers: "/operators/passengers",
  passenger: (id: string, tab?: string) => `/operators/passengers/${encodeURIComponent(id)}${tab ? `/${tab}` : ""}`,
  drivers: "/operators/drivers",
  driver: (id: string, tab?: string) => `/operators/drivers/${encodeURIComponent(id)}${tab ? `/${tab}` : ""}`,
  /** Order pages are built by the other admin terminal. */
  order: (id: string) => `/operators/orders/${encodeURIComponent(id)}`,
};

/** Value of ?request= that opens the "Menejerga so'rov" modal. */
export const requestParam = (kind: OpSubjectKind, id: string) => `${kind}:${id}`;

export const PASSENGER_STATUS: Record<PassengerStatus, { label: string; tone: BadgeTone }> = {
  active: { label: "Faol", tone: "success" },
  warned: { label: "Ogohlantirilgan", tone: "warning" },
  blocked: { label: "Bloklangan", tone: "neutral" },
};

export const OP_PAYMENT_TYPE: Record<OpPaymentType, string> = {
  card: "Karta",
  payme: "Payme",
  click: "Click",
  cash: "Naqd",
  refund: "Qaytarish",
  tip: "Choy puli",
};

export const OP_PAYMENT_STATUS: Record<OpPaymentStatus, { label: string; tone: BadgeTone }> = {
  held: { label: "Ushlab turilgan", tone: "info" },
  paid: { label: "To'landi", tone: "success" },
  refunded: { label: "Qaytarildi", tone: "info" },
  failed: { label: "Xato", tone: "danger" },
  to_driver: { label: "Haydovchiga", tone: "neutral" },
};

export const SMS_TYPE: Record<OpSmsType, string> = {
  login: "Kirish kodi",
  login_retry: "Kirish kodi (qayta)",
  login_resent: "Kirish kodi (operator qayta yubordi)",
};

export const SMS_RESULT: Record<OpSmsResult, { label: string; tone: BadgeTone }> = {
  delivered: { label: "Yetkazildi", tone: "success" },
  entered: { label: "Kirdi", tone: "success" },
  wrong_code: { label: "Kod noto'g'ri", tone: "warning" },
  limit: { label: "Limit", tone: "danger" },
  not_delivered: { label: "Yetkazilmadi", tone: "danger" },
};

export const NOTE_CATEGORY: Record<OpNoteCategory, { label: string; className: string }> = {
  complaint: { label: "Shikoyat", className: "bg-error-soft text-error" },
  login: { label: "Kirish", className: "bg-info-soft text-info" },
  payment: { label: "To'lov", className: "bg-info-soft text-info" },
  info: { label: "Ma'lumot", className: "bg-surface text-ink" },
};

export const REQUEST_TYPE: Record<OpRequestType, string> = {
  refund: "Pul qaytarish",
  sms_unlock: "Limitni ochish",
  ledger_fix: "Daftar tuzatish",
  compensation: "Kompensatsiya",
  penalty_cancel: "Jarimani bekor qilish",
  block: "Bloklash",
  unblock: "Blokdan chiqarish",
  phone_change: "Telefon raqamini almashtirish",
  deletion_cancel: "O'chirish so'rovini bekor qilish",
};

export const REQUEST_STATUS: Record<OpRequestStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "Kutilmoqda", tone: "warning" },
  approved: { label: "Tasdiqlandi", tone: "success" },
  rejected: { label: "Rad etildi", tone: "danger" },
};

export { orderNo, ORDER_STATUS, CANCELLED_BY_LABEL, PAYMENT_LABEL } from "@/features/orders/labels";
