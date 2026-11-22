# Handoff: admin (redesign v2)

Changes outside `admin/` that the admin redesign needs. The admin terminal does not edit these files; the reviewer applies them.

## 1. Phone numbers in full in admin (decision 2026-11-22)

Owner decision: in the admin panel phone numbers are shown in full everywhere, for all roles. No masking, no "Telefonni ochish" button, no reveal audit entry. Format: `+998 90 123 45 67`.

Admin code already follows it (commit "admin v2: show phone numbers in full"). Shared docs still say the opposite:

- `docs/izgo-dizayn-v2.md`, section "Admin (20 sahifa)":
  - now: `- Telefon raqamlari hamma joyda maskalangan; to'liq ochish audit jurnaliga yoziladi.`
  - new: `- Telefon raqamlari hamma joyda, hamma rol uchun to'liq ko'rinadi (+998 90 123 45 67). Maskalash va "Telefonni ochish" tugmasi yo'q (2026-11-22).`
- `docs/izgo-asosiy-hujjat.md`, 2.5 "Operator":
  - now: `- [TAKLIF] Ro'yxatda raqam maskalangan, to'liq raqam faqat "Boshlash"dan keyin joriy vazifada ko'rinadi. Operator faqat o'z tarixini ko'radi, yuqori rollar hammasini ko'radi.`
  - new: `- Admin panelda telefon raqamlari hamma rol uchun to'liq ko'rinadi, maskalash yo'q [QAROR] (2026-11-22). Operator faqat o'z tarixini ko'radi, yuqori rollar hammasini ko'radi.`
- `docs/izgo-asosiy-hujjat.md`, 9 "Qarorlar jurnali": add a row
  `| 2026-11-22 | Admin: telefon raqamlari hamma joyda va hamma rol uchun to'liq ko'rinadi; maskalash va "Telefonni ochish" olib tashlandi. | QAROR |`
- Design files `design-v2/admin/*.dc.html` still show masked numbers (`+998 9• ••• •• 21`) and a "Telefonni ochish" button. The admin code ignores those parts; no change needed unless the canvas is regenerated.

Not affected: F-26 (PII masked in central logs) and open question 10 (passenger and driver seeing each other's number) are about other things.

## 2. Operator windows, results and postpone (owner answers, 2026-11-22)

Group 5 follows the design and the owner's answers. Shared docs to update:

- `docs/izgo-asosiy-hujjat.md`, 2.5 "Operator", line "Operator o'zi faqat "Navbat" va "Tarix" oynalarini ko'radi.":
  - new: `Operator o'zi "Navbat" va "Tarix" oynalarini ko'radi; "Tarix"da o'z vazifalari va buyurtmalar (faqat ko'rish), alohida "Haydovchilar" (faqat ko'rish, balanssiz). [QAROR] (2026-11-22)`
- Same section, add:
  - `- Vazifa natijalari: Hal qilindi, Javob bermadi, Qayta qo'ng'iroq, Menejerga yuborildi, Rad etish (sabab majburiy). [QAROR] (2026-11-22)`
  - `- "Keyinga qoldirish": vazifa navbatga qaytadi, kutish vaqti saqlanadi. [QAROR] (2026-11-22)`
- 2.5 "Marketolog": `Marketolog "Umumiy statistika" (Marketing) sahifasini va daromad/buyurtma holatlari bo'limini faqat ko'radi. [QAROR] (2026-11-22)`
- 9 "Qarorlar jurnali": one row for the three points above.
- Backend parts are in `docs/backend-gaps/admin.md`, "Group 5".
