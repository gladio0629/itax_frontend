import type { BadgeTone } from "@/components/Badge";
import type { ManagerRequestStatus, ManagerRequestType } from "@/api/ops/types";

/** Request type names (design OpRequest / ManagerRequests, doc 2.5). */
export const REQUEST_TYPE: Record<ManagerRequestType, string> = {
  refund: "Pul qaytarish",
  compensation: "Kompensatsiya",
  penalty_cancel: "Jarimani bekor qilish",
  ledger_fix: "Daftar tuzatish",
  block: "Bloklash",
  unblock: "Blokdan chiqarish",
  phone_change: "Telefon raqamini almashtirish",
  deletion_cancel: "O'chirish so'rovini bekor qilish",
};
export const REQUEST_TYPES = Object.keys(REQUEST_TYPE) as ManagerRequestType[];

export const REQUEST_STATUS: Record<ManagerRequestStatus, { label: string; tone: BadgeTone }> = {
  pending: { label: "Kutilmoqda", tone: "warning" },
  approved: { label: "Tasdiqlandi", tone: "success" },
  rejected: { label: "Rad etildi", tone: "danger" },
};
