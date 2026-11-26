import type { BadgeTone } from "@/components/Badge";
import type { PassengerStatus } from "@/api/types";
import type {
  OpNoteCategory,
  OpPaymentStatus,
  OpPaymentType,
  OpSmsResult,
  OpSmsType,
} from "@/api/opCards/types";

/** Value of ?request= that opens the "Menejerga so'rov" modal. */
export { requestParam } from "@/features/ops/requestParam";

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

export { orderNo, ORDER_STATUS, CANCELLED_BY_LABEL, PAYMENT_LABEL } from "@/features/orders/labels";
