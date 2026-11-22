// Test panel texts. Kept out of the main dictionaries so the production
// build (where every reference sits behind DEMO_MODE) carries none of them.
import type { Locale } from "@/lib/i18n/provider";

const uz = {
  title: "Sinov paneli",
  intro: "Holatlarni tez almashtirish uchun. Barcha ma'lumotlar namunaviy va faqat shu brauzerda saqlanadi.",
  roles: "Haydovchi holati",
  "preset.new": "Yangi haydovchi (ro'yxatdan o'tish)",
  "preset.active": "Faol haydovchi",
  "preset.near_debt": "Qarz chegarasiga yaqin",
  "preset.debt": "Qarz chegarasida",
  "preset.bonus": "Bonus faol (0%)",
  events: "Hodisalar",
  emitRequest: "Yangi so'rov yuborish",
  emitFull: "Yangi so'rov: barcha tafsilotlar",
  emitCargo: "Yangi kargo so'rov",
  takeRequest: "So'rovni boshqa haydovchi oldi",
  fillSeats: "Joylar to'lgan",
  debtLimit: "Qarz chegarasi",
  network: "Tarmoq",
  slow: "Sekin internet",
  slowHint: "Har bir so'rov 2–3 soniya kechikadi",
  errors: "Xatoliklar",
  errorsHint: "So'rovlarning yarmi xato bilan tugaydi",
  reset: "Hammasini tiklash",
  resetTitle: "Hammasini tiklaysizmi?",
  resetDesc: "Barcha namunaviy ma'lumotlar boshlang'ich holatga qaytadi.",
  applied: "Holat qo'llandi",
  minimal: "Minimal server ma'lumoti",
  minimalHint: "Haqiqiy backend hozir yubormaydigan maydonlarsiz (vaqt, yo'lovchi, ETA, kutish, xulosa)",
  uiGallery: "UI namunalari",
  uiGalleryHint: "Yangi dizayn komponentlari va holatlar",
};

export type TestPanelKey = keyof typeof uz;

const ru: Record<TestPanelKey, string> = {
  title: "Тестовая панель",
  intro: "Для быстрой смены состояний. Все данные примерные и хранятся только в этом браузере.",
  roles: "Состояние водителя",
  "preset.new": "Новый водитель (регистрация)",
  "preset.active": "Активный водитель",
  "preset.near_debt": "Близко к лимиту долга",
  "preset.debt": "На лимите долга",
  "preset.bonus": "Бонус активен (0%)",
  events: "События",
  emitRequest: "Отправить новый запрос",
  emitFull: "Новый запрос: все детали",
  emitCargo: "Новый грузовой запрос",
  takeRequest: "Запрос забрал другой водитель",
  fillSeats: "Места заполнены",
  debtLimit: "Лимит долга",
  network: "Сеть",
  slow: "Медленный интернет",
  slowHint: "Каждый запрос задерживается на 2–3 секунды",
  errors: "Ошибки",
  errorsHint: "Половина запросов завершается ошибкой",
  reset: "Сбросить всё",
  resetTitle: "Сбросить всё?",
  resetDesc: "Все примерные данные вернутся к исходному состоянию.",
  applied: "Состояние применено",
  minimal: "Минимум данных с сервера",
  minimalHint: "Без полей, которых реальный бэкенд пока не присылает (время, пассажир, ETA, ожидание, итог)",
  uiGallery: "Образцы UI",
  uiGalleryHint: "Компоненты нового дизайна и состояния",
};

const en: Record<TestPanelKey, string> = {
  title: "Test panel",
  intro: "Switch states quickly. All data is sample data and stays in this browser.",
  roles: "Driver state",
  "preset.new": "New driver (sign-up)",
  "preset.active": "Active driver",
  "preset.near_debt": "Close to debt limit",
  "preset.debt": "At debt limit",
  "preset.bonus": "Bonus active (0%)",
  events: "Events",
  emitRequest: "Send a new request",
  emitFull: "New request: all details",
  emitCargo: "New cargo request",
  takeRequest: "Another driver takes a request",
  fillSeats: "Seats full",
  debtLimit: "Debt limit",
  network: "Network",
  slow: "Slow internet",
  slowHint: "Every request is delayed 2–3 seconds",
  errors: "Errors",
  errorsHint: "Half of requests fail",
  reset: "Reset everything",
  resetTitle: "Reset everything?",
  resetDesc: "All sample data returns to its starting state.",
  applied: "State applied",
  minimal: "Minimal server data",
  minimalHint: "Without the fields the real backend doesn't send yet (time, passenger, ETA, waiting, summary)",
  uiGallery: "UI samples",
  uiGalleryHint: "New design components and states",
};

const TEXT: Record<Locale, Record<TestPanelKey, string>> = { uz, ru, en };

export function testPanelText(locale: Locale, key: TestPanelKey): string {
  return TEXT[locale][key];
}
