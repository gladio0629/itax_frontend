// Contract error keys (api/openapi.yml) → the Uzbek text the admin UI shows.
// The admin panel has no i18n (Uzbek only); screens render `err.message`. Unknown keys
// fall back to a generic message. Never interpolate personal data here.
import type { ErrorParams } from "@shared/http/errors";

const GENERIC = "Xatolik yuz berdi. Qayta urinib ko'ring.";

const FORBIDDEN_REASON: Record<string, string> = {
  not_in_progress: "Bu vazifa jarayonda emas.",
  not_assigned: "Bu vazifa sizga biriktirilmagan.",
  invalid_state: "Bu holatdan bunday o'zgartirib bo'lmaydi.",
  staff_inactive: "Hisobingiz faol emas.",
  invalid_transition: "Shikoyatni bu holatga o'tkazib bo'lmaydi. Ochiq shikoyatni avval ko'rib chiqishga oling (o'zingizga biriktiring).",
  complaint_closed: "Shikoyat allaqachon yopilgan.",
  driver_assigned: "Buyurtmaga haydovchi biriktirilgan: endi uni tahrirlab bo'lmaydi.",
  trip_started: "Safar boshlangan: buyurtmani o'zgartirib yoki bekor qilib bo'lmaydi.",
  order_closed: "Buyurtma yakunlangan yoki bekor qilingan.",
};

const MESSAGES: Record<string, (p: ErrorParams) => string> = {
  AUTH_OTP_INVALID: (p) =>
    typeof p.attempts_left === "number" ? `Kod noto'g'ri. Yana ${p.attempts_left} ta urinish qoldi.` : "Kod noto'g'ri.",
  AUTH_OTP_EXPIRED: () => "Kod muddati tugadi. Yangi kod so'rang.",
  AUTH_OTP_RATE_LIMITED: (p) =>
    typeof p.retry_after === "number"
      ? `Juda ko'p urinish. ${p.retry_after} soniyadan keyin qayta urinib ko'ring.`
      : "Juda ko'p urinish. Birozdan keyin qayta urinib ko'ring.",
  AUTH_TOKEN_EXPIRED: () => "Sessiya tugadi. Qaytadan kiring.",
  FORBIDDEN: (p) => (typeof p.reason === "string" && FORBIDDEN_REASON[p.reason]) || "Bu amal uchun ruxsatingiz yo'q.",
  STAFF_EMAIL_TAKEN: () => "Bu email boshqa xodimga biriktirilgan.",
  STAFF_PHONE_TAKEN: () => "Bu telefon raqami boshqa xodimga biriktirilgan.",
  STAFF_NOT_FOUND: () => "Xodim topilmadi.",
  DRIVER_NOT_FOUND: () => "Haydovchi topilmadi.",
  PASSENGER_NOT_FOUND: () => "Yo'lovchi topilmadi.",
  TARIFF_NOT_FOUND: () => "Tarif topilmadi.",
  IDEMPOTENCY_KEY_REUSED: () => "Bu so'rov boshqa ma'lumot bilan allaqachon yuborilgan. Formani qayta to'ldiring.",
  ORDER_NOT_FOUND: () => "Buyurtma topilmadi.",
  TRIP_ORDER_UNAVAILABLE: () => "Buyurtmalar xizmati javob bermadi. Keyinroq urinib ko'ring.",
  IDENTITY_UNAVAILABLE: () => "Kirish xizmati javob bermadi. Keyinroq urinib ko'ring.",
  NOT_FOUND: () => "Ma'lumot topilmadi.",
  VALIDATION_ERROR: () => "Ma'lumotlar noto'g'ri. Maydonlarni tekshirib, qayta yuboring.",
  INTERNAL_ERROR: () => "Serverda xatolik yuz berdi. Keyinroq urinib ko'ring.",
  NETWORK_ERROR: (p) =>
    p.reason === "timeout" ? "Server javob bermadi. Qayta urinib ko'ring." : "Ulanish uzildi. Internetni tekshirib, qayta urinib ko'ring.",
  NOT_SUPPORTED: () => "Bu funksiya hozircha mavjud emas.",
};

export function adminErrorMessage(key: string, params: ErrorParams): string {
  return MESSAGES[key]?.(params) ?? GENERIC;
}
