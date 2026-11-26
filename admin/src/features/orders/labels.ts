import type { BadgeTone } from "@/components/Badge";
import type { OrderCancelReasonCode, OrderKind, OrderStatus, PaymentMethod } from "@/api/types";

/** One status → label/tone map for every order view (list, dashboard,
 * detail, driver history). The status itself always comes from the server. */
export const ORDER_STATUS: Record<OrderStatus, { label: string; tone: BadgeTone }> = {
  searching: { label: "Qidirilmoqda", tone: "neutral" },
  accepted: { label: "Yo'lda", tone: "warning" },
  arrived: { label: "Yetib keldi", tone: "warning" },
  in_progress: { label: "Safarda", tone: "info" },
  completed: { label: "Tugadi", tone: "success" },
  cancelled: { label: "Bekor qilindi", tone: "danger" },
  no_driver: { label: "Haydovchi yo'q", tone: "danger" },
  expired: { label: "Muddati o'tdi", tone: "danger" },
};

/** Driver history: who cancelled, when the server says. */
export const CANCELLED_BY_LABEL = {
  driver: { label: "Haydovchi bekor qildi", tone: "danger" },
  passenger: { label: "Yo'lovchi bekor qildi", tone: "neutral" },
  admin: { label: "Admin bekor qildi", tone: "neutral" },
} as const satisfies Record<string, { label: string; tone: BadgeTone }>;

export const KIND_LABEL: Record<OrderKind, string> = { passenger: "Yo'lovchi", delivery: "Dostavka" };

export const PAYMENT_LABEL: Record<PaymentMethod, string> = { cash: "Naqd", card: "Karta", wallet: "Hamyon", payme: "Payme", click: "Click" };

export const CANCEL_REASON_LABEL: Record<OrderCancelReasonCode, string> = {
  admin_decision: "Admin qarori",
  passenger_request: "Yo'lovchi so'rovi",
  driver_request: "Haydovchi so'rovi",
  duplicate: "Takroriy buyurtma",
  fraud: "Firibgarlik",
  other: "Boshqa sabab",
};

/** Codes the server may put in Order.cancel_reason (admin and passenger reasons). */
export const CANCEL_CODE_LABEL: Record<string, string> = {
  ...CANCEL_REASON_LABEL,
  changed_plans: "Rejalar o'zgardi",
  long_wait: "Uzoq kutish",
  driver_asked: "Haydovchi so'radi",
  wrong_address: "Manzil noto'g'ri",
};

/** Short display number: sample ids are "ord_123", real ones are UUIDs. */
export const orderNo = (id: string) => `#${id.startsWith("ord_") ? id.slice(4) : id.slice(0, 8)}`;
