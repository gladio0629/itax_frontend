# IZGO: asosiy hujjat (yagona manba)

Versiya 1.8 · 2026-11-22 · Til: o'zbek (lotin)

## 0. Bu hujjat nima uchun

- Frontend chati ham, backend chati ham shu hujjatga tayanadi. Qaror o'zgarsa, avval shu hujjat yangilanadi va 9-bo'limdagi jurnalga yoziladi, keyin chatlar unga qaraydi.
- Bu hujjatda va chatlarda maxfiy ma'lumot (bank kalitlari, parollar, tokenlar, haqiqiy telefon va karta raqamlari) bo'lmaydi.
- Belgilar:
  - **[QAROR]**: foydalanuvchi (loyiha egasi) aniq aytgan yoki tasdiqlagan.
  - **[TAKLIF]**: Claude taklif qilgan, hali yakuniy tasdiqlanmagan.
  - **[OCHIQ]**: hali hal bo'lmagan savol.
- Eslatma: hujjat mantiqiy (yuqori darajadagi) arxitektura. Hosting, tarmoq va joylashtirish tafsilotlari hali yo'q.

## 1. Mahsulot

IZGO: O'zbekistonda shaharlar va viloyatlar aro taksi platformasi. [QAROR]

Uch qism, bir-biriga bog'langan:
1. **IZGO**: yo'lovchilar uchun mobil ilova. Faqat telefon va faqat yo'lovchi.
2. **IZGO Driver**: haydovchilar uchun mobil ilova. Faqat haydovchilar kira oladi.
3. **IZGO Admin**: faqat jamoa uchun web panel. Begona hech kim kira olmasligi shart.

Asosiy talablar [QAROR]:
- Mikroservis arxitektura: bitta qism ishlamay qolsa, butun platforma to'xtamasligi kerak.
- Biznes modeli standart taksi platformaga o'xshaydi (bonuslar, xizmatlar). Farqi: juda sodda va ko'zga yoqimli dizayn, hamda past internetda ham yengil ishlash.
- Interfeys tili: o'zbek (lotin) asosiy. Yo'lovchi ilovasida (client) rus va ingliz tillari ham bo'ladi, til sozlamalarda tanlanadi. [QAROR] (2026-11-10) [OCHIQ: driver va admin tillari]

## 2. Biznes qoidalari

### 2.1 Buyurtma va taklif [QAROR]
- Yo'lovchi buyurtma beradi: olish nuqtasi, tushirish nuqtasi, o'rindiq (yoki butun mashina), vaqt.
- Narx har yo'lovchining o'z yo'liga qarab hisoblanadi.
- Vaqt: yo'lovchi aniq vaqt yoki vaqt oralig'ini kiritadi (masalan, 08:00 dan 12:00 gacha). Bu oraliq yo'lovchini olish vaqti hisoblanadi.
- Taklif faqat olish nuqtasi radiusiga tushgan va bo'sh o'rindig'i bor haydovchilarga ko'rinadi.
- [SINOVDA] (2026-11-14) Haydovchida online/oflayn holati yo'q (Rizo Go kabi). Ro'yxatdan o'tgach haydovchi o'zi tanlagan yo'nalishlardagi (masalan Toshkent ⇄ Samarqand) va bo'sh joyiga mos so'rovlarni ro'yxatda ko'radi, yangi so'rovda bildirishnoma oladi, "Qabul qilish" yoki "Rad etish" bosadi. Birinchi qabul qilgan oladi qoidasi qoladi. Qarz chegarasida qabul qilish bloklanadi. Radius o'rniga yo'nalish bo'yicha saralash — frontend demo'dan keyin hal qilinadi.
- **Birinchi qabul qilgan haydovchi oladi.** Yo'lovchiga shu vaqtda "qidirilmoqda" ko'rsatiladi.
- Haydovchi qabul qilgach, yo'lovchiga haydovchining ismi, yuzi va mashinasi ko'rinadi.
- Hech kim qabul qilmasa, yo'lovchiga "haydovchi yo'q" deyiladi.
- Buyurtma turi (2026-11-10): **yo'lovchi** yoki **dostavka** (yuk). Yo'lovchi uchun o'rindiq tanlanadi (1/2/3 kishi yoki butun mashina). Dostavka uchun kuzov o'lchami tanlanadi: S, M, L, XL, XXL, 3XL (mashina nomlari ishlatilmaydi; o'lcham va maksimal vazn serverdan keladi). Hajm va vazn qo'lda kiritilmaydi, narx serverda hisoblanadi. (2026-11-22, oldingi Spark→Fura bekor)
- Buyurtma parametrlari: qayerdan va qayerga (xaritadan tanlash yoki yozish), to'lov usuli (naqd, karta, to'lov tizimlari: Payme va Click), vaqt (haydovchi istagan paytda yoki aniq sana va vaqt/oraliq).
- Buyurtma qo'shimchalari (2026-11-14) [SINOVDA: avval frontend demo'da ko'riladi, keyin qaysilari qolishi hal qilinadi], Yandex Go bilan solishtiruvdan keyin:
  - Har manzilda "Tafsilotlar": podyezd, qavat, kvartira, domofon kodi, izoh (taksi va kargo).
  - Oraliq to'xtashlar (3 tagacha), haydovchiga izoh, bagaj soni. Istaklar (bolalar o'rindig'i, hayvon, konditsioner va h.k.) butunlay olib tashlandi: client'da ham, driver'ning "Imkoniyatlarim"ida ham yo'q (2026-11-22). Haydovchi imkoniyatlaridan faqat dostavka kuzovi va yukchi qoladi.
  - Avtomobil klassi (Standart, Komfort, Biznes, Miniven), boshqa odamga buyurtma (ism, telefon), promo kod, choy puli, marshrutni ulashish. Favqulodda kontaktlar YO'Q (2026-11-22).
  - Kargo: yo'nalish turi (shahar ichi, shaharlararo, marketpleysga), yukchilar (yo'q/1/2), narx hisobi (marshrut yoki soatbay), jo'natuvchi va qabul qiluvchi kontakti, kabinada hamroh, bir nechta tushirish manzili, sug'urta ma'lumoti.
  - Narxning hamma qismi (klass, istaklar, yukchi, kutish, chaqiruv, to'xtash, talab koeffitsienti, bekor qilish) faqat serverda. Frontend serverdan kelgan narx qatorlarini ko'rsatadi.
  - Haydovchini takliflardan tanlash QO'SHILMAYDI: "birinchi qabul qilgan oladi" qoidasi qoladi.
- Safardan keyin yo'lovchi haydovchini 1-5 yulduz bilan baholaydi va bahoni keyin o'zgartira oladi. 5 baho uchun sabab so'raladi: hush muomala, yaxshi suhbatdosh, komfort, shunchaki yoki o'z matni.

### 2.2 Hamyon va komissiya [QAROR]
- Haydovchining platformada shaxsiy hamyoni bor.
- Kartadan to'lovda pul haydovchi hamyoniga tushadi va 10% komissiya avtomatik yechiladi.
- Naqd to'lovda komissiya hamyondagi puldan ayriladi. Hamyon manfiy bo'lishi mumkin.
- Qarz chegarasi: −50 000 so'm. Chegaraga yetsa, haydovchi yangi buyurtma qabul qila olmaydi. Allaqachon qabul qilgan buyurtmasi bekor bo'lmaydi.
- Haydovchi hamyonni to'ldirib qarzni kamaytirgach, yana buyurtma qabul qila oladi.
- Hamyon **buxgalteriya daftari** tamoyilida: balans bevosita o'zgarmaydi, har harakat (to'lov, komissiya, to'ldirish, bonus) alohida yozuv, balans yozuvlar yig'indisi.

### 2.3 Haydovchi ro'yxati [QAROR]
- Haydovchi 4 qadamli ro'yxatdan o'tadi (hujjatlar, selfi).
- Haydovchini qo'lda tekshirish yo'q: qonuniy sabablarga ko'ra jamoa haydovchilarni o'zi tekshirmaydi. Tekshiruv davlat bilan kelishilgan holda avtomatik amalga oshiriladi. Admin panelda "haydovchini tasdiqlash" bo'limi yo'q. (2026-11-09)
- Admin haydovchi akkauntini bloklashi va blokdan chiqarishi mumkin (2.5).
- [OCHIQ] Davlat tizimi bilan avtomatik tekshiruv: qaysi tizim, qaysi ma'lumotlar, hujjat va selfi qayerda va qancha saqlanadi (F-17, F-22 ga ta'siri).

### 2.4 Keyinga qoldirilgan va hal bo'lmagan
- Bonus servisi (komissiyani bonus bilan qoplash, promo, referal): keyingi bosqich. [QAROR]
- [OCHIQ] Bekor qilish qoidalari va jarimalar.
- [OCHIQ] "Haydovchi yo'q" holati qachon chiqadi (3-5 daqiqa yoki ertangi buyurtma uchun soatlar).
- [OCHIQ] Vaqt oralig'i uzunligi chegarasi (masalan, 4 soatdan oshmasin).
- [OCHIQ] Haydovchi reysining ketish vaqti aniq vaqtmi yoki oraliqmi.
- [OCHIQ] Haydovchiga pul yechib berish (payout), qaytarish (refund) va chargeback.
- [OCHIQ] Haydovchi o'zi reys e'lon qiladimi.
- [OCHIQ] Shahar ichidagi taksi buyurtmalari bormi. (Kargo uchun shahar ichi bor, 2026-11-14.)
- [OCHIQ] Yo'lovchining hamyoni bormi? Hujjatda faqat haydovchi hamyoni bor. Frontend demo'da client ilovasiga Hamyon ekrani qo'shilib qolgan, qaror kutilmoqda.
- [OCHIQ] Dostavka: narx qanday hisoblanadi, yuk hajmi va vazn chegaralari, haydovchi tomonida qanday ko'rinadi.
- [OCHIQ] "Haydovchi istagan paytda" varianti: vaqt oralig'i chegarasi bilan (F-24) qanday bog'lanadi.
- [OCHIQ] Bahoni o'zgartirish muddati (cheksizmi yoki cheklanganmi).
- [OCHIQ] Yo'lovchi bonuslari (frontend demo'da mock, backend keyingi bosqich): nimaga beriladi, birligi, muddati, "yechib olish" nima degani (pul, chegirma yoki boshqa).
- [OCHIQ] Client'da bir nechta akkaunt (qo'shish, almashtirish) va akkauntni o'chirish: qonun talablari bilan (F-22).
- [TAKLIF] Yordam zayavkasi operator navbatiga tushadi (2.5), operator zayavka qoldirgan raqamga qo'ng'iroq qiladi.
- [OCHIQ] Narx qiymatlari: istaklar narxi, yukchi narxi, soatbay narx, bepul kutish daqiqalari va kutish narxi, chaqiruv narxi, to'xtash narxi, talab ko'p paytdagi koeffitsient, bekor qilish jarimasi, choy pulidan komissiya olinadimi, sug'urta hamkori. Demo'da mock qiymatlar.
- [OCHIQ] Superadmin yangi superadmin yarata oladimi (2.5).
- [OCHIQ] Operator navbatiga vazifa qanday tushadi va qo'ng'iroq qanday amalga oshadi (2.5).

### 2.5 Admin panel: xodimlar, rollar va kirish

Admin panelga faqat jamoa xodimlari kiradi. Foydalanuvchilar ko'paygan sari xodimlar ham ko'payadi. Bo'lim "Rollar" emas, "Xodimlar" deb nomlanadi. [QAROR]

**Rollar va ruxsatlar [QAROR]:**

| Rol | Ko'radigan bo'limlari | Xodim yaratish huquqi |
|---|---|---|
| superadmin | hamma bo'lim va statistika, jumladan operator oynalari | hamma rol, jumladan owner |
| owner | hamma bo'lim va statistika | menejer, marketolog, operator. Owner va superadmin yarata olmaydi |
| menejer | hamma bo'lim va statistika | marketolog, operator. Menejer, owner, superadmin yarata olmaydi |
| marketolog | faqat "Umumiy statistika", lekin hamma turdagi statistika: yo'lovchi, haydovchi, buyurtma sonlari, shuningdek daromad va pulga oid ko'rsatkichlar. Faqat ko'rish. Boshqa bo'limlar yo'q (2026-11-09) | yo'q |
| operator | faqat o'z oynalari: "Navbat" va "Tarix" | yo'q |

**Operator [QAROR]:** vazifasi kirishda muammosi bor, qo'shimcha ma'lumotga muhtoj yoki shikoyat qilmoqchi bo'lgan odamlarga qo'ng'iroq qilish.
- "Navbat" oynasi: qo'ng'iroq qilinadigan telefon raqamlar ro'yxati. Har birida "Boshlash" va "Rad etish" tugmasi.
- "Tarix" oynasi: operatorning ko'rib chiqqan vazifalari (tasdiqlangan, rad etilgan va h.k.). Natija va izohni tahrirlash mumkin.
- Operatordan boshqa rollar (superadmin, owner, menejer) "Operatorlar" bo'limini 3 qismda ko'radi: **Navbat**, **Jarayonda**, **Bugungi tasdiqlanganlar**. Operator o'zi faqat "Navbat" va "Tarix" oynalarini ko'radi. [QAROR]
- Operator hisobini jamoa yaratadi: operator telefon raqamini aytadi, xodim hisob ochadi. Telefon hamma rol uchun majburiy. Email operatordan boshqa hamma rol uchun majburiy, operator uchun shart emas. [QAROR]
- [QAROR] (2026-11-22) Admin panelda telefon raqamlari hamma joyda to'liq ko'rinadi (maskalash yo'q). Operator faqat o'z tarixini ko'radi, yuqori rollar hammasini ko'radi.
- [TAKLIF] Yuqori rollar uchun uchinchi qism sukut bo'yicha bugungi tasdiqlanganlarni ko'rsatadi, sana va natija filtri bor (rad etilganlar va eski kunlar ham topiladi).

**Kirish (xavfsizlik) [QAROR]:**
- Operatordan boshqa hamma uchun 2 qadam: email'ga kelgan kod + telefonga SMS kodi.
- Operator uchun 1 qadam: telefonga SMS kodi.
- Har safar chiqqandan keyin qaytadan to'liq kirish kerak (eslab qolish yo'q). Noqulay bo'lsa ham, xavfsizlik uchun.
- F-06 dagi FIDO2 hozircha majburiy emas. [TAKLIF] Superadmin va owner uchun keyinchalik authenticator yoki kalit qo'shish (faqat SMS SIM-karta almashtirish orqali buzilishi mumkin).

**Ma'lumotlar bilan ishlash [QAROR]:**
- Haydovchi, yo'lovchi, buyurtma, hamyon va to'lov, tarif, xodim bo'limlarida ko'rish, qo'shish, tahrirlash va "o'chirish" amallari bor.
- "O'chirish" = arxivlash yoki bloklash (qaytarish mumkin). Haqiqiy o'chirish keyin, qonun talablariga ko'ra (F-22).
- Hamyon daftari o'zgarmaydi (2.2): yozuv tahrirlanmaydi va o'chirilmaydi. Xato bo'lsa sabab bilan "tuzatish yozuvi" qo'shiladi.
- Tarif o'zgarishi va tuzatish yozuvi: **ikki kishi tasdig'i yo'q** (2026-11-22). Bitta xodim 2 bosqichda tasdiqlaydi: o'zgartiradi, "Saqlash" bosadi, tasdiqlash oynasi (modal) chiqadi, "Tasdiqlash" bosilgach kuchga kiradi. Har o'zgarish audit jurnaliga yoziladi (kim, nima, qachon). Admin'da "Tasdiqlar" bo'limi yo'q.
- Tarif modeli (2026-11-22): asosiy narx = masofa (km) × 1 litr yoqilg'i narxi (gaz yoki benzin, admin kiritadi). Ustiga har yo'lovchi klassi (Standart, Komfort, Biznes, Miniven) va har dostavka kuzovi (S–3XL) uchun ustama: foiz yoki aniq summa. Qo'shimcha to'lovlar (kutish, to'xtash, yukchi, bekor qilish) alohida. O'zgarish yangi buyurtmalarga qo'llanadi, oldindan berilgan buyurtmada narx qotirilgan. Hisob faqat serverda.

**Ro'yxatlar [QAROR]:** har bir ro'yxatda (hamma bo'limda, hamma rol uchun, jumladan operator va marketolog oynalarida) qidiruv va filtr bor.

**Qo'shimchalar [TAKLIF]:**
- Xodim holati: faol / bloklangan.
- O'zgarmas audit jurnali (kim, nima, qachon).
- Eksport faqat superadmin va owner uchun.
- Harakatsiz bo'lsa avtomatik chiqish.
- Xodim faqat o'zi yarata oladigan rollardagi xodimlarni tahrirlaydi va arxivlaydi.

**Frontend uchun:** bo'limlarni yashirish faqat ko'rinish. Haqiqiy ruxsatni backend tekshiradi. Frontend ruxsat ro'yxatini serverdan oladi (demo'da mock).

## 3. Arxitektura (v2, xavfsizlik hisobga olingan)

Holat: [TAKLIF]. Foydalanuvchi so'rovi bilan chizilgan, yakuniy tasdiq kutilmoqda.

### 3.1 Qatlamlar
1. **Mijozlar:** IZGO, IZGO Driver (attestatsiya, Keystore/Keychain), IZGO Admin (faqat VPN).
2. **Himoya:** CDN + WAF + DDoS (ochiq trafik), Admin SSO (alohida IdP, MFA: email + SMS, 2.5).
3. **Gateway'lar (Kong yoki Envoy):** Public API (sxema validatsiyasi, rate limit, marshrut allowlist), Realtime (ulanishda token, obuna ruxsati), To'lov callback (imzo, IP ro'yxati, faqat Wallet'ga), Admin Gateway (VPN, IP ro'yxat, faqat Backoffice).
4. **Servislar (11 ta):** hammasi ichki zonada, mTLS bilan, har birida alohida baza va hisob.
5. **Platforma qatlami:** Event Bus (NATS JetStream), Vault + KMS (sirlar, sertifikatlar, dinamik DB hisoblari), Audit + SIEM (o'zgarmas log, signallar), Egress proxy (tashqariga faqat ruxsat etilgan manzillar).
6. **Tashqi tizimlar:** SMS provayder, Hamkorbank / Payme / Click, Mapbox, FCM / APNs.

### 3.2 Servislar

| Servis | Til | Baza | Tashqi tizim | Chiqaradigan hodisalar |
|---|---|---|---|---|
| Identity | Go | PostgreSQL | SMS provayder | user.created |
| Driver | TypeScript (NestJS) | PostgreSQL, fayl ombori | yo'q | driver.submitted, driver.approved |
| Trip & Order | Go | PostgreSQL, Redis (qulf) | yo'q | order.created, order.accepted, trip.completed |
| Matching & Geo | Go | Redis GEO | Mapbox | offer.created |
| Pricing | Go | PostgreSQL | yo'q | yo'q |
| Wallet | Kotlin (Spring Boot) | PostgreSQL (daftar, faqat qo'shish) | Hamkorbank, Payme, Click | payment.paid, wallet.limit_reached |
| Notification | Go | Redis (navbat) | FCM, APNs, SMS | yo'q |
| Bonus (keyingi bosqich) | Kotlin | PostgreSQL | yo'q | bonus.granted |
| Backoffice | TypeScript (NestJS) | PostgreSQL | yo'q | yo'q |
| Risk / Antifrod (yangi) | Go | [OCHIQ] | yo'q | [OCHIQ] |
| Hujjat skaneri (yangi) | Go | yo'q | yo'q | [OCHIQ] |

Servislar vazifasi:
- **Identity:** telefon + SMS kod bilan kirish, tokenlar, rollar.
- **Driver:** 4 qadamli ro'yxat, hujjatlar, profil, avtomatik tekshiruv holati.
- **Trip & Order:** reys, buyurtma, o'rindiq, "birinchi qabul qilgan oladi" qulfi.
- **Matching & Geo:** radius qidiruvi, GPS oqimi, yo'l tartibi.
- **Pricing:** masofa × 1 litr yoqilg'i narxi + klass/kuzov ustamasi (2.5), qo'shimcha to'lovlar.
- **Wallet:** hamyon daftari, komissiya, qarz chegarasi, to'lov provayderlari.
- **Notification:** push va SMS, internet qaytganda yetkazish.
- **Backoffice:** admin orqa qismi (xodimlar va rollar, operator navbati, support, shikoyat, tarif).
- **Risk:** soxta GPS, soxta safar, OTP va referal suiiste'moli signallari.
- **Hujjat skaneri:** antivirus va EXIF tozalash.

Tillar bo'yicha qaror: Go (tezlik talab qiladigan servislar), Kotlin (pul bilan bog'liq), TypeScript (admin va CRUD). Gateway'lar va Event Bus uchun kod yozilmaydi, tayyor vosita ishlatiladi. [TAKLIF]

### 3.3 Buyurtma oqimi
1. Yo'lovchi buyurtma yuboradi (Public Gateway orqali) → Trip & Order buyurtmani yaratadi.
2. Trip & Order Pricing'dan narx oladi (sinxron) va Matching & Geo'dan radiusdagi, bo'sh o'rindiqli haydovchilarni oladi (sinxron).
3. Hodisa → Notification → haydovchilarga push (yo'lovchida "qidirilmoqda").
4. Birinchi qabul qilgan haydovchi qulf (Redis) orqali oladi, ikkinchisiga "allaqachon olingan".
5. Hodisa → yo'lovchiga haydovchi ma'lumoti.
6. Haydovchi "safar tugadi" → hodisa trip.completed → Wallet komissiyani yechadi.
7. Qabul paytida Wallet'dan sinxron tekshiruv: qarz chegarasi va ochiq majburiyatlar (F-13).

## 4. Xavfsizlik talablari

Asos: arxitektura xavfsizlik tekshiruvi (2026-11-06). Natija: **shartli qulay**. Quyidagi 27 topilma qabul sharti: deploy'dan oldin har biri yopilgan yoki ongli qaror bilan qabul qilingan bo'lishi kerak. Bosqich ustuni: [TAKLIF].

| ID | Talab | Servis | Xavf | Bosqich |
|---|---|---|---|---|
| F-01 | Event Bus: servis boshiga hisob, faqat o'z mavzusiga yozish, TLS, hodisa sxemasi va idempotentlik | Event Bus | Yuqori | MVP |
| F-02 | Servislar orasida mTLS, "kim kimni chaqira oladi" ro'yxati, token va rolni servis ichida qayta tekshirish | Hammasi | Yuqori | MVP |
| F-03 | Public Gateway'da marshrutlar "taqiqlangan, ruxsat etilganlargina" tamoyilida; Pricing, Notification, Bonus tashqariga chiqmaydi | Gateway | O'rta | MVP |
| F-04 | OTP: telefon + qurilma + IP bo'yicha qatlamli limit, kod muddati va urinishlar soni, attestatsiya, SMS byudjeti signali | Identity | Yuqori | MVP |
| F-05 | Token: asimmetrik imzo (algoritm ro'yxati), access ~15 daqiqa, bir martalik refresh va qayta ishlatishni aniqlash, har ilova uchun alohida audience, bekor qilish ro'yxati | Identity | Yuqori | MVP |
| F-06 | Admin uchun alohida IdP/SSO + MFA (hozir: email kodi + SMS kodi, operator: faqat SMS; FIDO2 keyinroq, 2.5-bo'lim), alohida issuer va imzo kaliti | Admin | Yuqori | MVP |
| F-07 | Backoffice: mayda rollar (2.5-bo'lim), tarif va hamyon tuzatishda 2 bosqichli tasdiq (bitta xodim, modal; ikki kishi tasdig'i 2026-11-22 da bekor), o'zgarmas audit, telefon maskalash (2026-11-22: admin panelda bekor, raqam to'liq ko'rinadi), eksport cheklovi | Backoffice | Yuqori | MVP (rollar, audit), keyin (to'liq) |
| F-08 | Admin veb-panel: chiqishda escape, CSP, HttpOnly/SameSite cookie, hujjatni alohida domendan ko'rsatish | Backoffice | O'rta | MVP |
| F-09 | Driver: yoziladigan maydonlar ro'yxati (DTO), status faqat Backoffice orqali; gateway'da OpenAPI sxemasi (noma'lum maydonlarni rad etish, hajm cheklovi) | Driver | Yuqori | MVP |
| F-10 | Har so'rovda obyekt egaligi tekshiruvi (buyurtma, hamyon, joylashuv), UUID/ULID, ketma-ket ID signali | Trip & Order, Wallet, Matching | Yuqori | MVP |
| F-11 | GPS: attestatsiya, mock-location aniqlash, tezlik/sakrash tekshiruvi, narx faqat serverdagi marshrutdan | Matching, Pricing | Yuqori | 2-bosqich (asosiy tekshiruvlar MVP'da) |
| F-12 | trip.completed uchun dalil (GPS izi), bir xil juftliklar naqshi, bonuslarni kechiktirish | Trip & Order, Risk | O'rta | 2-bosqich |
| F-13 | Qabul paytida sinxron "hold" tekshiruvi, faol buyurtmalar limiti, ledger'da idempotentlik kalitlari | Wallet, Trip & Order | Yuqori | MVP |
| F-14 | To'lov callback: alohida eshik, imzo va IP ro'yxati, idempotentlik, summani provayderdan qayta tekshirish, kunlik solishtirish | Wallet | Yuqori | MVP |
| F-15 | Karta raqami IzGo serveriga tushmasin (provayder sahifasi/SDK orqali tokenlash); faqat token va oxirgi 4 raqam. PCI DSS doirasi tekshirilsin | Wallet | O'rta | MVP (arxitektura qarori) |
| F-16 | Sirlar Vault/secret manager'da, har servisga qisqa muddatli DB hisobi, test kalitlarni almashtirish, CI'da sir skaneri | Hammasi | Yuqori | Hozir |
| F-17 | Hujjat/selfi: yopiq ombor, qisqa muddatli imzolangan URL, shifrlash, fayl tekshiruvi, EXIF tozalash, kirish auditi | Driver, Hujjat skaneri | Yuqori | MVP |
| F-18 | Akkaunt ulashishga qarshi jonli selfi, akkaunt = ishonchli qurilma, yo'lovchi uchun "haydovchi mos emas" tugmasi | Driver | O'rta | 2-bosqich |
| F-19 | Real-time kanal: ulanishda token, muddati tugagach uzish, faqat o'z buyurtmasiga obuna, ulanishlar limiti | Realtime Gateway | O'rta | MVP |
| F-20 | Gateway ko'p nusxada, timeout va circuit breaker, Pricing keshi, Redis HA, DDoS himoya | Gateway, Redis | O'rta | MVP / 2-bosqich |
| F-21 | Push'da minimal mazmun (hodisa ID), tafsilot ilovada serverdan olinadi | Notification | O'rta | MVP |
| F-22 | Shaxsiy ma'lumotlar: ma'lumotlar xaritasi, saqlash muddatlari, shifrlash, joylashuv tarixini qisqartirish, o'chirish jarayoni; O'zbekiston qonuni talablari yurist bilan **tekshirilsin** | Hammasi | Yuqori | MVP |
| F-23 | Promo/referal: atomik ishlatish, limitlar, antifrod, bonusni kechiktirib berish | Bonus | O'rta | Bonus bilan |
| F-24 | Faol buyurtmalar limiti, "qidirilmoqda" muddati, oraliq uzunligi chegarasi | Trip & Order | O'rta | MVP |
| F-25 | Servis boshiga alohida baza/hisob, Redis'ni vazifa bo'yicha ajratish, ACL, parol, TLS | Hammasi | O'rta | MVP |
| F-26 | Markaziy log (PII maskalangan), o'zgarmas audit, signallar (enumeration, OTP, GPS, hamyon nomuvofiqligi) | Platforma | Yuqori | MVP |
| F-27 | Mobil ilovalar: Keystore/Keychain, attestatsiya, ilovada minimal sir, tashqi tokenlarni cheklash | Ilovalar | O'rta | 2-bosqich |

Eng muhim 10 ish (tartib bilan):
1. Sirlarni Vault'ga o'tkazish va chatda yuborilgan Hamkorbank test kalit/parollarini almashtirish (F-16). Qiymatlar bu hujjatga yozilmaydi.
2. Token va rol dizayni, adminni alohida IdP va MFA bilan ajratish (F-05, F-06).
3. mTLS, Event Bus ruxsatlari, ichki servislarni gateway'dan olib tashlash (F-01, F-02, F-03).
4. BOLA/BOPLA devori: egalik tekshiruvi, DTO, sxema validatsiyasi (F-09, F-10).
5. OTP himoyasi (F-04).
6. Wallet yaxlitligi: callback, idempotentlik, qarz chegarasi hold, karta raqami bizga tushmasligi (F-13, F-14, F-15).
7. GPS va safar yaxlitligi, akkaunt ulashishga qarshi choralar (F-11, F-12, F-18).
8. Backoffice: rollar, 2 bosqichli tasdiq, audit, XSS (F-07, F-08, F-26).
9. Hujjat ombori va shaxsiy ma'lumotlar (F-17, F-22).
10. Chidamlilik va real-time kanal (F-19, F-20).

## 5. API shartnomasi

Holat: hali yozilmagan. Quyidagi qoidalar va guruhlar [TAKLIF].

Qoidalar:
- REST/JSON, OpenAPI shartnomasi yagona manba. Frontend mock server ham, backend ham shundan chiqadi.
- Noma'lum maydonlar rad etiladi, har maydonga tur va uzunlik chegarasi beriladi.
- Obyekt ID lari UUID/ULID.
- **Narx, masofa, status, komissiya va qarz chegarasi faqat serverda hisoblanadi.** Klient hech qachon yubormaydi.
- To'lov va hamyon so'rovlarida idempotency kaliti majburiy.
- Har javob kichik hajmli (past internet uchun). Ro'yxatlar sahifalanadi.
- Real-time kanal turi (WebSocket, SSE yoki polling) [OCHIQ].

Endpoint guruhlari (qoralama):
- **Auth:** OTP so'rash, OTP tasdiqlash, token yangilash, chiqish.
- **Driver:** ro'yxat qadamlari, hujjat yuklash (imzolangan URL), holat.
- **Buyurtma (yo'lovchi):** yaratish, olish, bekor qilish, tarix.
- **Takliflar va safar (haydovchi):** takliflar ro'yxati, qabul qilish, safarni boshlash va tugatish.
- **Hamyon:** balans, daftar, to'ldirishni boshlash, karta ulash (provayder sahifasi orqali).
- **Bildirishnomalar va sozlamalar:** ro'yxat, o'qilgan deb belgilash, profil, afzalliklar, qurilmalar.
- **Admin:** xodimlar (rollar bo'yicha), operator navbati va tarixi, haydovchilar va yo'lovchilar (blok/arxiv), buyurtmalar, hamyon (tuzatish yozuvi) va to'lovlar, tariflar (yoqilg'i narxi, ustamalar, 2 bosqichli tasdiq), audit, shikoyatlar, risk, umumiy statistika.

## 6. Frontend

Holat (oxirgi ma'lum): uchta demo ilova qurilgan, rebrand tugagan (4 commit). Admin 2.5-bo'lim bo'yicha kengaytirilgan. Hozir client ilovasi qayta quriladi (2026-11-10), keyin driver.

- Ilovalar: client (5173), driver (5174, tungi rejim), admin (5175). React 18 + TypeScript + Vite + Tailwind + react-router + zustand.
- Haqiqiy joylashuv: `/home/gladio/p/project_hat/onlyfront/` (Sardor laptopi) [QAROR] (2026-11-15). Oldingi joy: `/home/bilol/Documents/work/frontend/`.
- Demo qoidalari [QAROR]: faqat soxta (mock) ma'lumot, tashqi tarmoq chaqiruvi yo'q (`check:no-network`), CSP `connect-src 'self'`, hamma ma'lumot olish `src/api/client.ts` (`ApiAdapter`) orqali. `mockAdapter` ishlaydi, `httpAdapter` bo'sh stub. `VITE_DEMO_MODE` bayrog'i ostida.
- Tekshiruv talab qiladigan harakatlar (OTP, email kodi, hujjat, karta, to'ldirish, 2FA) `submitForReview()` orqali: "Tekshiruvga yuborildi" holati, 2-4 soniyadan keyin avtomatik tasdiq.
- Demo boshqaruv paneli: bazani tiklash, stsenariylar (haydovchi topilmasin, sekin internet, xato, hamyon limiti, vaqtni tezlashtirish). Admin uchun: har bir rol sifatida kirib ko'rish.
- Haqiqiy backend'ga o'tish: faqat `httpAdapter` yoziladi. Frontend'da biznes mantiq yo'q.
- Backend'ga ulanish [QAROR] (2026-11-15): Kong `http://localhost:8000`, manzil `VITE_API_URL` dan. `VITE_DEMO_MODE=false` bo'lsa `httpAdapter` ishlaydi. Shartnoma: backend `openapi.yml` (frontend'ga nusxa `frontend/api/openapi.yml`). Sarlavhalar: `Authorization: Bearer`, `X-App: client|driver|admin`. Xato: `{ error: { key, params } }`. Ro'yxat: cursor. Real-time: WebSocket `/ws`.
- Joylashtirish [QAROR] (2026-11-15): hozircha bepul hostinglarga (statik sayt sifatida). Backend URL hali yo'q: `VITE_API_URL` bo'sh qoldiriladi, server qo'yilgach to'ldiriladi va qayta build qilinadi. Hosting HTTPS bo'lgani uchun backend ham HTTPS/WSS bo'lishi shart.
- Domenlar [QAROR] (2026-11-17): client va driver faqat mobil ilova (Capacitor: `uz.izgo.client`, `uz.izgo.driver`), web hosting kerak emas. Admin Vercel'da: `https://admin.xasanow.uz` (domen Eskiz'da, DNS Vercel'ga). Backend `https://api.xasanow.uz`. `xasanow.uz` keyinroq yuklab olish sahifasi uchun. Backend CORS va `WS_ALLOWED_ORIGINS`: `https://admin.xasanow.uz`, `capacitor://localhost`, `https://localhost`. Eslatma: admin ommaviy internetda, 3.1 dagi "faqat VPN" [TAKLIF] hozircha qo'llanmaydi; himoya 2.5 dagi 2 qadamli kirishga tayanadi.
- Ilovalarda "demo" so'zi ko'rinmaydi. Sinov paneli faqat `VITE_DEMO_MODE=true` da bo'ladi, aks holda bundle'ga kirmaydi.
- CSP `connect-src`: `'self'` + API va WebSocket manzili. Dev'da Vite proxy (`/api`, `/admin`, `/ws` → Kong) ishlatiladi: CORS kerak bo'lmaydi va iPhone'dan LAN orqali ham ishlaydi.
- Backend'da hali yo'q funksiyalar (sinovdagilar va boshqalar) http rejimda yashiriladi. Yetishmayotgan endpointlar ro'yxati `frontend/docs/backend-gaps.md` da, backend chati uchun.
- Brend [QAROR]: ranglar IZGO logosidan (ko'k, sariq, oq). Logo fayli: `brand/izgo-logo.jpeg`. O'lchangan HEX: ko'k `#264A9F`, sariq `#F6BF0E`. Qoidalar: sariq faqat to'ldirish rangi (matn yoki ingichka ikonka sifatida oq fonda emas), uning ustida to'q ko'k matn; ogohlantirish rangi sariq emas, to'q sariq (orange); katta maydonlar och, to'yingan ko'k faqat sarlavha, navigatsiya va asosiy elementlarda; kontrast WCAG AA; haydovchi tungi rejimi logo ko'kining to'q (navy) tusida.
- Mobil ilovalar (client, driver) [QAROR]: burchaklar va tuzilma Yandex Go uslubida (2026-11-15 dan: katta yumaloq sheet va kartochkalar, kapsula chiplar, katta sariq tugma; aniq qiymatlar `brand/yandex_photos` skrinshotlaridan o'lchanadi; faqat ranglar, logo va rasmlar IZGO'niki; oldingi 8/12/16 bekor), taksi ilovalariga o'xshash tuzilma (to'liq ekran xarita + pastki sheet), **statistika bo'limi yo'q** (faqat hamyon, daftar, "Bugungi daromad" raqami, safarlar tarixi), xaritalarda O'zbekiston siluet xaritasi (statik SVG, tashqi so'rovsiz), uchala ilovada Sozlamalar bo'limi.
- iPhone (iOS) uchun alohida interfeys [QAROR] (2026-11-14): iPhone'dan kirilganda ilova iOS uslubiga o'tadi (Telegram iOS kabi): iOS radiuslari, katta sarlavhalar, shaffof navigatsiya, guruhlangan ro'yxatlar, iOS switch, action sheet, safe area. Boshqa qurilmalarda hozirgi dizayn (8/12/16) qoladi. Faqat ko'rinish o'zgaradi, biznes mantiq va API bir xil. Avval client, keyin driver.
- Client (yo'lovchi) navigatsiya [QAROR] (2026-11-10): pastki navbar yo'q. Yuqori chap burchakda 3 chiziqli tugma, chapdan menyu: **Asosiy, Bonuslar, Tarix, Sozlamalar**. Yo'lovchi Hamyon ekrani navigatsiyadan olib tashlanadi (qaror kutilmoqda, 2.4).
  - **Asosiy:** to'liq ekran (soxta) xarita + pastki sheet'da buyurtma: qayerdan, qayerga, buyurtma turi (yo'lovchi yoki dostavka), vaqt, to'lov usuli. Narx faqat serverdan.
  - **Bonuslar:** yuqorida jami bonus, "Bonusni yechib olish" tugmasi, bonus olish yo'llari (batafsil + "Amalni bajarish"), bonuslar tarixi. Hammasi mock.
  - **Tarix:** safarlar ro'yxati (haydovchi rasmi va ismi, qayerdan qayerga, baho), batafsil sahifa, bahoni o'zgartirish, 5 baho uchun sabab tanlash.
  - **Sozlamalar** (Telegram uslubida): Akkaunt (telefon, ism, familiya; qo'shish, tahrirlash, o'chirish), Bildirishnomalar (hammasi, taksi holati, yangiliklar, bonuslar), Tizim rangi (och/to'q, joyida almashtirgich), Til (modal: o'zbek, rus, ingliz), Yordam (zayavka qoldirish), Biz haqimizda.
- Admin [QAROR]: qayta ranglangan, dashboard va grafiklar qoladi. 2.5 bo'yicha kengaytiriladi: Xodimlar (5 rol), operator oynalari (Navbat, Tarix), barcha bo'limlarda qo'shish/tahrirlash/arxivlash, 2 qadamli kirish. Haydovchini tasdiqlash bo'limi olib tashlanadi (2.3).

## 7. Texnologiyalar (xulosa)

Go, Kotlin (Spring Boot), TypeScript (NestJS), PostgreSQL, Redis, NATS JetStream (Kafka o'rniga: hisob va ruxsatlar oddiyroq) [TAKLIF], Kong yoki Envoy (gateway), Vault + KMS, Mapbox (xaritani ko'rsatish frontendda, ochiq `pk.` token domen bilan cheklangan; marshrut, masofa, narx va geokoder faqat serverda), FCM/APNs, Hamkorbank/Payme/Click.

## 8. Ochiq savollar (javob kerak)

1. Hosting qayerda (bulut yoki o'z serveri, qaysi mamlakat)? Kubernetes ishlatiladimi?
2. Gateway JWT'ni o'zi tekshiradimi yoki Identity'ga murojaat qiladimi? Ichki servislar tokenni qayta tekshiradimi?
3. Servislar orasidagi qaysi chaqiruvlar sinxron va ular qanday autentifikatsiya qilinadi?
4. Real-time kanal nima (WebSocket, SSE, polling)? Qaysi servis ulanishni ushlaydi?
5. Karta kiritish: provayder sahifasi/SDK'mi yoki o'zimizning forma? Karta raqami bizga tushadimi?
6. Haydovchiga pul yechish, qaytarish va chargeback bormi?
7. Admin kirishi: email kodi + SMS (2.5), qaysi IdP bilan amalga oshadi? Dispetcher o'rniga operator roli bor (2.5).
8. Narx va masofa serverdagi marshrut bo'yichami yoki haydovchi GPS'idanmi? Narx qachon qotiriladi? Pricing parametrlari (km narxi, yoqilg'i, old o'rindiq qo'shimchasi)?
9. Joylashuv tarixi va telefon uchun saqlash muddati? Foydalanuvchi roziligi va o'chirish jarayoni?
10. Yo'lovchi va haydovchi bir-birining telefon raqamini ko'radimi (maskalangan qo'ng'iroq)?
11. Log, monitoring va intsident javobi qanday?
12. Haqiqiy mobil ilovalar texnologiyasi (Flutter, React Native yoki native)? Attestatsiya rejasi?
13. Event Bus: NATS yoki Kafka (yakuniy)? Hodisa sxemalari va versiyalash?
14. Har servisning PostgreSQL va Redis'i alohida instansmi?
15. Biznes savollari: 2.4-bo'limdagi barcha [OCHIQ] bandlar.

## 9. Qarorlar jurnali

| Sana | Qaror | Holat |
|---|---|---|
| 2026-11-05 | IZGO uch qism, mikroservis arxitektura, taksi platforma modeli | [QAROR] |
| 2026-11-05 | Hamyon qoidalari (10% komissiya, −50 000 chegarasi, daftar), birinchi qabul qilgan oladi, vaqt oralig'i | [QAROR] |
| 2026-11-06 | Arxitektura v1: 9 servis, 2 gateway, Event Bus | [TAKLIF], ishlatilmoqda |
| 2026-11-06 | Tillar: Go, Kotlin, TypeScript | [TAKLIF] |
| 2026-11-06 | Xavfsizlik tekshiruvi: 27 topilma, natija shartli qulay | Hisobot tayyor |
| 2026-11-06 | Arxitektura v2 (zonalar, mTLS, Vault, Risk, Hujjat skaneri, 4 gateway) | [TAKLIF], tasdiq kutilmoqda |
| 2026-11-07 | Frontend demo: mock baza, "tekshiruvga yuborildi" avtomatik o'tadi, backend'ga zarar yo'q | [QAROR] |
| 2026-11-07 | Ranglar IZGO logosidan; mobilda statistika yo'q; O'zbekiston xaritasi; barcha ilovada Sozlamalar; burchaklar kamroq yumaloq | [QAROR] |
| 2026-11-09 | Haqiqiy frontend papkasi: `/home/bilol/Documents/work/frontend/` | [QAROR] |
| 2026-11-09 | Ikki alohida chat: frontend va backend, shu hujjat umumiy manba | [QAROR] |
| 2026-11-09 | Frontend rebrand tugadi: 3 ilova, ko'k #264A9F, sariq #F6BF0E | Bajarildi |
| 2026-11-09 | Haydovchi tekshiruvi qo'lda emas, davlat bilan avtomatik. Admin'da tasdiqlash bo'limi yo'q | [QAROR] |
| 2026-11-09 | Admin: "Xodimlar" bo'limi, 5 rol (superadmin, owner, menejer, marketolog, operator), ruxsatlar, operator oynalari | [QAROR] |
| 2026-11-09 | Admin kirish: email kodi + SMS (operator: faqat SMS), har chiqishdan keyin qayta kirish | [QAROR] |
| 2026-11-09 | "O'chirish" = arxivlash/bloklash. Hamyon daftari o'zgarmaydi (tuzatish yozuvi). Tarif o'zgarishi ikki kishi tasdig'i bilan | [QAROR] |
| 2026-11-09 | Xodim holati, audit jurnali, eksport cheklovi, avto-chiqish, telefon maskalash, tahrir huquqi qoidasi | [TAKLIF] |
| 2026-11-09 | Operatorlar bo'limi yuqori rollar uchun 3 qism: Navbat, Jarayonda, Bugungi tasdiqlanganlar. Operator hisobini jamoa yaratadi (telefon majburiy, operatorga email shart emas) | [QAROR] |
| 2026-11-09 | Marketolog hamma turdagi statistikani ko'radi, daromad va pul ko'rsatkichlari ham (faqat ko'rish). Oldingi "pul ma'lumoti yo'q" bekor | [QAROR] |
| 2026-11-09 | Hamma ro'yxatda qidiruv va filtr, hamma rol uchun | [QAROR] |
| 2026-11-10 | Client: pastki navbar o'rniga chap menyu (Asosiy, Bonuslar, Tarix, Sozlamalar), Yandex Go uslubidagi bosh sahifa | [QAROR] |
| 2026-11-10 | Buyurtma parametrlari: dostavka (yuk hajmi va vazni) yoki o'rindiq; to'lov: naqd, karta, Payme/Click; vaqt: istagan paytda yoki sana va vaqt | [QAROR] |
| 2026-11-10 | Baholash: 1-5 yulduz, o'zgartirish mumkin, 5 baho uchun sabab (4 variant + boshqa) | [QAROR] |
| 2026-11-10 | Client tillari: o'zbek (asosiy), rus, ingliz | [QAROR] |
| 2026-11-10 | Yo'lovchi Bonuslar ekrani frontend demo'da (mock); Yordam zayavkasi operatorga | [QAROR] demo, qoidalar [OCHIQ] |
| 2026-11-11 | Dostavka: mashina turi tanlash (Spark→Fura), hajm/vazn kiritish olib tashlandi | [QAROR] |
| 2026-11-11 | Driver: tablar Asosiy, Hamyon, Tarix, Profil. Bugungi daromad Hamyonga ko'chdi. Buyurtmalar→Tarix | [QAROR] |
| 2026-11-11 | Driver: bonus darajalari (Bronza 10%, Kumush 5%, Oltin 0%) — frontend demo mock, backend keyingi bosqich | [QAROR] demo |
| 2026-11-14 | iPhone uchun alohida iOS uslubidagi interfeys (avval client), o'z radiuslari bilan; boshqa qurilmalarda 8/12/16 | [QAROR] |
| 2026-11-16 | Xavfsizlik: F-16 (sirlar secrets/ ga), F-25 Postgres qismi (servis boshiga parol va baza), F-02 1-bosqich (ichki token, policy.json) bajarildi. Kong admin API va Redis/NATS LAN'da ochiq ekani topilib yopildi. Qolgan: F-01 NATS, Redis ACL (tasdiqlandi), Kong rate-limit va OpenAPI validatsiya (F-03, F-09, F-20), mTLS, Hamkorbank kalitlarini bank bilan almashtirish | Jarayonda |
| 2026-11-16 | Frontend 100 operatsiyali shartnomaga ulandi, to'liq oqim haqiqiy backend bilan tekshirildi (login, quote, buyurtma, jonli holatlar, baho, admin 5 rol, logout). Backend kamchiliklari: buyurtmada haydovchi ma'lumoti yo'q (2.1 [QAROR] ga zid), yo'nalishlar matching'da ishlatilmaydi, admin'da haydovchi/yo'lovchi/daftar soxta, old o'rindiq qo'shimchasi yo'q | Bajarildi, kamchiliklar ochiq |
| 2026-11-15 | Backend frontend'ga moslandi: shaharlar, manzil qidirish, narx oldindan (quote_id), o'rindiq tanlash, admin logout, WS subprotocol auth, driver va admin endpointlari (100 operatsiya), dev OTP va seed. Hali yo'q: ko'cha geokoderi, bir mashinada bir nechta yo'lovchi, buyurtma qo'shimchalari, bonus, kartalar, chat | Bajarildi |
| 2026-11-15 | Frontend Sardor laptopiga ko'chiriladi: `/home/gladio/p/project_hat/onlyfront/` | [QAROR] |
| 2026-11-15 | Frontend backend'ga ulanadi: httpAdapter, Kong localhost:8000, Vite proxy, "demo" yozuvlari olib tashlanadi, yetishmayotgan endpointlar backend-gaps.md ga | [QAROR] |
| 2026-11-15 | Client dizayni Yandex Go uslubida (burchaklar, sheet, chiplar, tugmalar, buyurtma oqimi). Ranglar, logo, rasmlar IZGO'niki. Yandex logosi, shrifti va rasmlari ishlatilmaydi | [QAROR] |
| 2026-11-14 | Driver: online/oflayn olib tashlanadi, yo'nalish bo'yicha so'rovlar ro'yxati, bildirishnoma, Qabul qilish / Rad etish (Rizo Go kabi) | Frontend'da sinovda |
| 2026-11-14 | Yandex Go bilan solishtiruv: manzil tafsilotlari, to'xtashlar, izoh, istaklar, bagaj, klass, boshqa odamga buyurtma, promo, choy puli, xavfsizlik; kargo: yo'nalish turi, yukchilar, soatbay, kontaktlar, hamroh, ko'p manzil. Haydovchi tanlash qo'shilmaydi | Frontend'da sinovda, backend kutadi; narx qiymatlari [OCHIQ] |
| 2026-11-17 | Client va driver faqat mobil ilova (Capacitor). Admin Vercel'da admin.xasanow.uz, backend api.xasanow.uz. Domen Eskiz'da | [QAROR] |
| 2026-11-17 | Mapbox: xarita ko'rsatish frontendda (client, driver; ochiq token), hisob-kitoblar serverda | [QAROR] |
| 2026-11-17 | Driver ilovasida orqa fonda GPS kerak, lekin keyingi bosqichda (1.0 versiyada faqat ilova ochiq paytda) | [QAROR] |
| 2026-11-20 | Google Play: IZGO (uz.izgo.client) va IZGO Driver (uz.izgo.driver) yopiq testga (Alpha, Uzbekistan, 12 tester) yuborildi. Shaxsiy akkaunt: production uchun 12 tester × 14 kun. Sayt izgo.uz / xasanow.uz: privacy, terms, delete-account. Review akkauntlari: +998900000001 (yo'lovchi), +998900000002 (haydovchi), kod backend secrets'da. App Store: keyingi qadam | Jarayonda |
| 2026-11-20 | App Store: IZGO (uz.izgo.client) build 1.0 (1) yuklandi, faqat iPhone (TARGETED_DEVICE_FAMILY=1). Sahifa, maxfiylik (8 tur), yosh 18+, skrinshotlar tayyor. Qoldi: kategoriya Путешествия, kontent huquqlari, narx bepul + faqat Uzbekistan, keyin Добавить для проверки. IZGO Driver App Store'ga hali yuklanmagan | Jarayonda |
| 2026-11-21 | App Store: IZGO 1.0 Apple ko'rigiga yuborildi (Ожидание проверки, 48 soatgacha). Bepul, faqat Uzbekistan, 18+, kategoriya Путешествия. Keyingi: IZGO Driver'ni App Store'ga yuklash | Jarayonda |
| 2026-11-22 | Yangi dizayn (v2): client 46, driver 23, admin 20 ekran (Claude Design artefaktlari). Ishlash: `onlyfront`da, har ilova alohida branch/worktree, umumiy tekshiruvchi | [QAROR] |
| 2026-11-22 | Dostavka: kuzov o'lchami S, M, L, XL, XXL, 3XL. Mashina nomlari (Spark→Fura) bekor | [QAROR] |
| 2026-11-22 | Istaklar butunlay olib tashlandi (client va driver). Client'da "Bagaj va izoh": bagaj soni, izoh, boshqa odam uchun | [QAROR] |
| 2026-11-22 | Ikki kishi tasdig'i bekor. Tarif va hamyon tuzatishi: bitta xodim, 2 bosqich (Saqlash → tasdiqlash modali), audit jurnaliga yoziladi. "Tasdiqlar" bo'limi yo'q | [QAROR] |
| 2026-11-22 | Tarif modeli: masofa × 1 litr yoqilg'i (gaz/benzin) + klass yoki kuzov ustamasi (foiz yoki summa) | [QAROR] |
| 2026-11-22 | Admin: operator uchun "Tarix" va "Haydovchilar" (faqat ko'rish, balans ko'rinmaydi); haydovchi tarixi sahifasi | [QAROR] |
| 2026-11-22 | Favqulodda kontaktlar butunlay olib tashlandi (SOS tugmasi va marshrutni ulashish qoladi) | [QAROR] |
| 2026-11-22 | Admin panelda telefon raqamlari to'liq ko'rinadi, maskalash va "Telefonni ochish" tugmasi yo'q | [QAROR] |
| 2026-11-22 | Ilovalardagi sayt havolalari faqat https://xasanow.uz/terms, /privacy va /delete-account (client va driver). Manzil kodda (config.ts), .env git'da yo'q. Tarmoq tekshiruvida shu manzilga istisno | [QAROR] |
| 2026-11-22 | Admin faqat o'zbek tilida. Eski statistika Dashboard'ga qo'shimcha bo'lim bo'lib qaytadi, marketolog ham ko'radi (faqat ko'rish). Terminallar dizaynda ham, ilovada ham yo'q katta funksiya qo'shmaydi | [QAROR] |
| 2026-11-22 | Backend'da hali yo'q qismlar (bonus, promo, choy puli, to'xtashlar, klass, yukchi va h.k.) ham to'liq qilinadi. Dizayndagi raqamlar namuna, hammasi serverdan | [QAROR] |

## 10. Frontend o'zgarishlari — backend uchun xulosa (2026-11-09 – 2026-11-11)

Frontend demo qurildi. Quyidagilar backend arxitektura va API ga ta'sir qiladi. Mock adapter hozir bu ma'lumotlarni soxta qaytarmoqda — backend shu shartnomani amalga oshirishi kerak.

**Buyurtma tizimi (Trip & Order, Pricing):**
- Buyurtma ikki turli: **yo'lovchi** (o'rindiq: 1/2/3 kishi yoki butun mashina) va **dostavka** (kuzov o'lchami: S, M, L, XL, XXL, 3XL; 2026-11-22 dan, mashina nomlari bekor). Eski "yuk hajmi va vazni" olib tashlandi. Narx marshrut + mashina turi/o'rindiq soni bo'yicha serverda hisoblanadi.
- Vaqt: "haydovchi istagan paytda" yoki aniq sana va vaqt oralig'i (masalan, 08:00–12:00). Frontend faqat yuboradi, server tekshiradi.
- To'lov usullari: naqd, karta (token, oxirgi 4 raqam), Payme, Click.
- Buyurtma qabul bo'lgandan keyin yo'lovchi parametrlarni o'zgartirishi mumkin (adapter orqali `updateOrder`). Server ruxsat beradi yoki rad etadi.

**Baholash tizimi (Trip & Order):**
- Yo'lovchi haydovchini 1-5 yulduz bilan baholaydi. Bahoni keyin o'zgartirishi mumkin (server ruxsat bersa). 5 baho uchun sabab: hush muomala, yaxshi suhbatdosh, komfort, shunchaki, yoki o'z matni (max 200 belgi). API: `rateOrder`, `updateRating`.

**Yo'lovchi bonuslari (Bonus servisi — keyingi bosqich):**
- Frontend demo ko'rsatmoqda: balans, yechish (minimum va oylik maksimum chegarasi bilan), bonus olish yo'llari ro'yxati, tarix. Backend API kerak: `getBonus`, `withdrawBonus`, `getBonusSources`, `getBonusHistory`. Qoidalar hali [OCHIQ].

**Haydovchi bonuslari (Bonus servisi — keyingi bosqich):**
- Frontend demo: 3 daraja — Bronza (10% komissiya), Kumush (5%), Oltin (0%). Shartlar: haftalik safar soni, reyting, bekor qilish limiti. Backend: `getDriverBonus`, bonus darajasi va progress.

**Haydovchi hamyoni (Wallet):**
- Frontend: balans, qarz chegarasi (-50 000), to'ldirish (Payme/Click), karta ulash, daftar (faqat ko'rish). Qarz chegarasiga yaqinlashganda va yetganda banner ko'rsatiladi. Backend qarz holatini qaytaradi.

**Admin rollar va ruxsatlar (Backoffice, Identity):**
- 5 rol: superadmin, owner, menejer, marketolog, operator. Har rolning ko'radigan bo'limlari va yaratish huquqi aniq belgilangan (2.5-bo'lim). Backend `getMe()` da: rol, ruxsat etilgan bo'limlar, ruxsat etilgan amallar, yarata oladigan rollar qaytarilishi kerak.
- Kirish: email kodi + SMS kodi (2 qadam). Operator: faqat SMS (1 qadam). Har chiqishda sessiya to'liq tozalanadi.
- Operator navbati: vazifalar ro'yxati (telefon, sabab), "Boshlash"/"Rad etish", tarix. Yuqori rollar uchun 3 qism: Navbat, Jarayonda, Bugungi tasdiqlanganlar.

**Haydovchi tekshiruvi (Driver servisi):**
- Qo'lda tekshiruv olib tashlandi. Admin panelda "haydovchini tasdiqlash" bo'limi yo'q. Tekshiruv davlat tizimi bilan avtomatik. Backend: haydovchi holati faqat "Avtomatik tekshiruvda", "Faol", "Bloklangan".

**Ma'lumotlar bilan ishlash:**
- "O'chirish" = arxivlash/bloklash (qaytarish mumkin). Haqiqiy o'chirish keyinroq (F-22).
- Hamyon daftari: yozuv tahrirlanmaydi va o'chirilmaydi. Xato uchun "tuzatish yozuvi" + 2 bosqichli tasdiq (bitta xodim, modal), audit jurnaliga yoziladi (2026-11-22).
- Tarif o'zgarishi: 2 bosqichli tasdiq, ikki kishi tasdig'i yo'q (2026-11-22).
- Hamma ro'yxatda qidiruv va filtr. Server pagination, filtrlarni qabul qilishi kerak.

**Yordam zayavkasi:**
- Yo'lovchi va haydovchi zayavka qoldiradi (sabab, qisqa xabar). [TAKLIF] Zayavka operator navbatiga tushadi, operator qo'ng'iroq qiladi.

**2026-11-14 qo'shimchalari (Yandex solishtiruvidan keyin) — SINOVDA. Backend hozircha bularni QILMAYDI: foydalanuvchi frontend demo'ni ko'rib, qaysilari qolishini hal qiladi, keyin shu ro'yxat yangilanadi.**
- Buyurtma modeli yangi maydonlar: har manzilda `details` (podyezd, qavat, kvartira, domofon, izoh), `stops[]` (3 tagacha), `comment`, `options[]`, `luggageCount`, `carClass`, `passenger` (boshqa odam: ism, telefon), `promoCode`, `tip`. Kargo: `cargoScope` (city/intercity/marketplace), `loaders` (0/1/2), `pricingMode` (route/hours) va `hours`, `sender`/`receiver` kontaktlari, `rideAlong`, bir nechta `dropoffs[]`.
- Pricing: narx qatorlari (klass, istaklar, yukchi, soatbay, to'xtash, chaqiruv, kutish, talab koeffitsienti, promo) kalit bilan qaytadi. Oldindan buyurtmada narx qotiriladi. Bekor qilish jarimasi.
- Trip & Order: to'xtashlar, kutish taymeri (bepul daqiqalar, keyin pullik), manzil o'zgarishi, boshqa odamga buyurtma.
- Matching: haydovchini klass, istaklar (bolalar o'rindig'i bormi, hayvon oladimi, bagaj sig'imi) va kargo kuzovi bo'yicha saralash. Driver profiliga "imkoniyatlar" qo'shiladi.
- Notification: qabul qiluvchiga va boshqa yo'lovchiga SMS (minimal mazmun, F-21). Marshrutni ulashish: muddati tugaydigan imzolangan havola, minimal ma'lumot.
- Wallet: choy puli haydovchi daftariga alohida yozuv turi. Bekor qilish jarimasi yozuvi.
- Bonus: promo kodlar (F-23).
- Shaxsiy ma'lumot (F-22): kvartira, domofon kodi, qabul qiluvchi telefoni, favqulodda kontaktlar. Shifrlash (admin panelda telefon to'liq ko'rinadi, 2026-11-22), safardan keyin domofon kodini o'chirish.
- Admin: yangi maydonlarni ko'rsatish, klass va kuzov ustamalari, yoqilg'i narxi, yukchi narxini boshqarish (2 bosqichli tasdiq).

**Adapter shartnomasi (frontend kutmoqda):**
- Frontend xato kodlari kutadi (matn emas): `{ key: string; params?: Record<string, number|string> }`. Frontend o'zi 3 tilga o'giradi.
- Narx, masofa, status, komissiya, qarz, bonus — hammasi faqat serverdan.

## 11. Chatlar uchun qoidalar

**Frontend chati:** ekranlar, dizayn, demo ilovalar, API shartnomasining frontend tomoni. Biznes mantiq yozmaydi. Shartnomaga o'zgartirish kerak bo'lsa, avval shu hujjatga yozadi.

**Backend chati:** servislar, API shartnomasining server tomoni, xavfsizlik talablari (4-bo'lim), qurilish tartibi: platforma skeleti (gateway, mTLS, Vault, Event Bus, audit) → Identity → Driver va Trip & Order → Matching va Pricing → Wallet → Notification → Risk va Bonus.

**Arxitektura va xavfsizlik chati (asosiy):** qaror o'zgarishlari, xavfsizlik savollari, shu hujjatni yangilash.

Umumiy: har chat birinchi bo'lib shu hujjatni o'qiydi. Taklif qaror emas: [TAKLIF] belgisini [QAROR] ga faqat foydalanuvchi aytgandan keyin o'zgartiring.
