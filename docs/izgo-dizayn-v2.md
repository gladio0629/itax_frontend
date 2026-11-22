# IZGO: yangi dizayn (v2) — client, driver, admin

Sana: 2026-11-22 · Manba: Claude Design canvaslari. Bu faylning o'zi project hujjatidan nusxa (2026-11-22), kod uchun qisqartirilgan.

- Client canvas: https://claude.ai/artifact/HSb47UggkDzDp3URL1rVaH
- Driver canvas: https://claude.ai/artifact/Dbpxd86jPXTPaRr5SpsRUB
- Admin canvas: https://claude.ai/artifact/WmUy9LDk74dJhqRpYfXTBE
- Lokal nusxa: `design-v2/<app>/*.dc.html` (manba), `design-v2/<app>/png/*.png` (taxminiy rasm), `design-v2/<app>/assets/` (logo, mashina va kuzov rasmlari), `design-v2/<app>/canvas.json` (ekranlar ro'yxati va nomlari).

## Umumiy qarorlar [QAROR]

- Dizayn butunlay yangi (TaxiMode UI kit uslubi). Eski tuzilmani faqat qayta bo'yash EMAS.
- Kiritiladigan ma'lumotlar (inputlar) o'zgarmaydi va yo'qolmaydi, faqat ko'rinishi yangi.
- Ranglar: to'q ko'k va yashil. Eski ko'k `#264A9F` va sariq `#F6BF0E` yangi dizaynda ishlatilmaydi.
- Logo: eski shakl, yangi ranglar. "IZ" va "O" to'q ko'k `#0B1524`, "G" yashil pin `#2EDB85` ichida. To'q fonda harflar oq.
- G'oya "Tungi yo'l": ekran tepasi to'q (sarlavha va eng muhim raqam), pasti katta yumaloq oq varaq (maydonlar, ro'yxatlar).
- Xaritalar client va driver'da och rangli, pastki varaq oq.
- Narx, haydovchi ismi, mashina raqami, bonus va boshqa raqamlar dizaynda NAMUNA. Haqiqiy qiymat serverdan.

## Dizayn qiymatlari

| Nom | Qiymat | Qayerda |
|---|---|---|
| Ink | `#0B1524` | ekran foni (tepa), asosiy matn, tanlangan element |
| Ink 2 | `#142235` | to'q fon ustidagi kartochka |
| To'q chegara | `#24364D` | to'q fondagi chegara va chiziq |
| Yashil | `#2EDB85` | asosiy tugma (ustida Ink matn), faol qadam, belgi |
| Yashil matn | `#0C7A43` | oq fonda yashil matn va ikonka |
| Yashil och | `#E3F8EC` | holat belgisi foni, fokus halqasi |
| Fon | `#F3F5F8` | maydon (input) va kartochka foni |
| Chegara | `#E2E7EE` | ajratuvchi chiziq |
| Ikkinchi matn | `#5A6779` | label, izoh |
| To'q fondagi ikkinchi matn | `#9FB0C3` | |
| Xato | `#B42318`, fon `#FDECEA` | bekor qilingan, chiqish, o'chirish |
| Ogohlantirish | `#B54708` / `#F79009`, fon `#FFF1E6` | xato va internet yo'q holati |
| SOS | `#C8281C` | favqulodda tugma |

- Shrift: Plus Jakarta Sans (400, 600, 700, 800). Kichik label: 11px, 700, bosh harflar, harf oralig'i 0.8px.
- Radius: varaq 32, kartochka 24, maydon 20, ikonka katakchasi 14, tugma va chip to'liq yumaloq.
- Asosiy tugma: balandligi 60, yashil, matn chapda, o'ngda to'q doira ichida strelka.
- Maydon (input): balandligi 68, och fon, tepada kichik label, pastida qiymat. Fokusda: oq fon, 2px Ink chegara, 4px yashil och halqa.
- Eng kichik bosiladigan element 44. Mobil ekran 390×844. Admin 1440 kenglik, kenglikka moslashadi.
- Klaviatura ochilganda: tepa to'q qism siqiladi, oq varaq va asosiy tugma klaviatura ustida turadi (client'dagi Kb* ekranlari). Klaviaturaning o'zi tizimniki, ilova chizmaydi.
- Aylanadigan ro'yxatlarda scrollbar ko'rinmaydi.

## Client (46 ekran)

| Bo'lim | Ekran(lar) |
|---|---|
| Kirish | Main, Otp, Language |
| Asosiy: xarita, menyu, joriy joylashuv, qidiruv, buyurtma turi (Yo'lovchi / Dostavka), saqlangan manzillar (+ bo'sh holati) | Home, HomeEmpty |
| Manzil: qidiruv, xaritadan pin, podyezd, qavat, kvartira, domofon, izoh, saqlash | Address, MapPick, AddressDetails |
| Yo'lovchi buyurtmasi: oraliq to'xtashlar (3), o'rindiq tanlash, klass, bagaj va izoh, boshqa odam uchun, vaqt, to'lov, promo, narx qatorlari | Trip, Extras ("Bagaj va izoh"), Time, Payment |
| Dostavka: yo'nalish turi (shahar ichi / shaharlararo / marketpleys), bir nechta tushirish, kuzov S–3XL, jo'natuvchi va qabul qiluvchi, yukchilar, marshrut/soatbay, hamroh, sug'urta, vaqt, to'lov | Cargo, CargoContacts, CargoTerms, Payment |
| Qidirilmoqda, topilmadi | Search, NoDriver |
| Safar: haydovchi yo'lda, yetib keldi (kutish taymeri), safarda (yo'l chizig'i, SOS, ulashish) | Driver, Arrived, OnTrip |
| Baholash + choy puli | Rate |
| Tarix + qidiruv va filtr | History, HistoryDetail |
| Bonuslar | Bonus |
| Menyu, Sozlamalar, Akkaunt (o'chirish ham), Bildirishnomalar, Til, Yordam, Biz haqimizda | Menu, Settings, Account, Notifications, Language, Help, About |
| Klaviatura ochiq holatlari | KbMain, KbOtp, KbAddress, KbTime, KbPayment, KbRate, KbAccount, KbHelp, KbDetails, KbExtras, KbCargoContacts, KbHistory |
| Umumiy holatlar (hamma ro'yxatda) | StateLoading, StateEmpty, StateError, StateOffline |

- Yo'lovchi oqimi: Safar → To'lov → Qidirilmoqda → Haydovchi. Dostavka oqimi: Yuk → Kontakt → Shartlar → To'lov.
- O'rindiq tanlash: tepadan ko'rinadigan mashina, oldida haydovchi (tanlab bo'lmaydi) va 1 yo'lovchi, orqada 3 o'rindiq. Holatlar: bo'sh, tanlangan, band, haydovchi. Bir nechta o'rindiq tanlash mumkin. "Butun mashina" faqat hech qaysi joy band bo'lmaganda. Narx va tugma pastda qotib turadi.
- Avtomobil klassi: Standart, Komfort, Biznes, Miniven plitkalari (mashina rasmi, o'rin soni, nom, narx). NARX tanlangan klassga qarab serverdan.
- Dostavka kuzovi: S, M, L, XL, XXL, 3XL segmentli tanlagich, kuzov rasmi, o'lcham va "Maksimum N kg". Boshlang'ich: M. O'lcham, vazn va narx serverdan.
- Istaklar (bolalar o'rindig'i, hayvon, konditsioner va h.k.) YO'Q.
- Vaqt: Hozir / Aniq vaqt / Oraliq.

## Driver (23 ekran)

1. Kirish va ro'yxat: Main, Otp, RegPersonal, RegLicense, RegCar, RegSelfie, RegReview (avtomatik tekshiruv).
2. Ish jarayoni: Home (yo'nalish + so'rovlar ro'yxati, Qabul qilish / Rad etish), Request (yangi so'rov, taymer), OrderDetail (dostavka so'rovi), ToPickup, Waiting (bepul kutish, keyin pullik), OnTrip (SOS), Finished (komissiya, naqd eslatma, baho).
3. Hamyon va profil: Wallet (qarz chegarasi), WalletDebt (bloklangan holat), TopUp (Payme / Click / karta), History, Profile, Level (Bronza / Kumush / Oltin), Capabilities, Notifications, Settings.

- Online/offline tugmasi yo'q.
- Suzuvchi to'q tab bar: Asosiy / Hamyon / Tarix / Profil.
- 2026-11-22: istaklar butunlay olib tashlandi. Capabilities ekranida faqat dostavka kuzovi (S–3XL) va "yukchi sifatida yordam" qoladi. So'rov kartalaridagi "Katta bagaj", "Konditsioner", "1 bola" kabi istak belgilari ko'rsatilmaydi (bagaj soni va izoh qolishi mumkin).
- Komissiya foizi, daraja, balans: hammasi serverdan.

## Admin (20 sahifa)

1. Kirish: Main (email + email kodi), Verify (telefon + SMS kodi). Operator faqat telefon + SMS.
2. Asosiy: Dashboard, Orders, OrderDetail, Drivers (qo'lda tasdiqlash yo'q, faqat bloklash), DriverProfile, DriverHistory, Passengers.
3. Pul: Ledger (daftar o'zgarmaydi), LedgerFix (tuzatish yozuvi), Tariffs.
4. Jamoa: Operators (Navbat / Jarayonda / Bugungi tasdiqlanganlar), OperatorView (operator: Navbat), OperatorHistory va OperatorDrivers (operator: faqat ko'rish, balans ko'rinmaydi), Staff, StaffAdd, Audit, Marketing (faqat statistika, faqat ko'rish).

- Telefon raqamlari hamma joyda, hamma rol uchun to'liq ko'rinadi (+998 90 123 45 67). Maskalash va "Telefonni ochish" tugmasi yo'q (2026-11-22).
- "Tasdiqlar" bo'limi YO'Q. Ikki kishi tasdig'i YO'Q.
- **2 bosqichli tasdiq [QAROR 2026-11-22]:** tarif o'zgarishi va tuzatish yozuvi uchun bitta xodim: o'zgartiradi → "Saqlash" → tasdiqlash oynasi (modal: nima o'zgaradi, eski → yangi) → "Tasdiqlash" bosilsa kuchga kiradi, "Bekor qilish" bosilsa hech narsa o'zgarmaydi. Har o'zgarish audit jurnaliga yoziladi.
- Narx modeli: asosiy narx = masofa (km) × 1 litr yoqilg'i narxi (gaz yoki benzin). Har klass va kuzov uchun ustama: foiz yoki summa. Qo'shimcha to'lovlar: bepul kutish, kutish narxi, to'xtash, yukchi, bekor qilish jarimasi. Daraja komissiyalari. Hisob faqat serverda, admin faqat qiymatlarni kiritadi.
