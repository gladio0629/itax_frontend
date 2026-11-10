// Source-of-truth dictionary. ru.ts/en.ts are typed against this file's
// shape (Dictionary = typeof uz), so a missing or extra key fails `tsc`.
export const uz = {
  "drawer.open": "Menyuni ochish",
  "drawer.close": "Menyuni yopish",
  "drawer.asosiy": "Asosiy",
  "drawer.bonuslar": "Bonuslar",
  "drawer.tarix": "Tarix",
  "drawer.sozlamalar": "Sozlamalar",
  "drawer.version": "Versiya {{version}}",

  "common.back": "Orqaga",
  "common.close": "Yopish",
  "common.cancel": "Bekor qilish",
  "common.confirm": "Tasdiqlash",
  "common.save": "Saqlash",
  "common.retry": "Qayta urinish",
  "common.comingSoon": "Tez kunda",

  "theme.toggleToDark": "Tungi rejimga o'tish",
  "theme.toggleToLight": "Kunduzgi rejimga o'tish",
};

export type Dictionary = typeof uz;
export type TranslationKey = keyof Dictionary;
