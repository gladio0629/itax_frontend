// Shared seed dataset generator — this exact file is copied unchanged into
// client/driver/admin so the three demo apps show the SAME drivers,
// passengers, routes and orders. Pure function of a fixed seed: no Date.now,
// no Math.random. All data is fictional.
import { makeRng } from "@/lib/prng";

export type City = {
  id: string;
  name: string;
  region: string;
  lat: number;
  lng: number;
};

export type Tariff = {
  id: string;
  name: string;
  baseFare: number;
  perKmCar: number;
  perKmSeat: number;
  frontSeatSurcharge: number;
  fuelAdjustmentPct: number;
  commissionPct: number;
  archived: boolean;
};

export type DriverStatus = "auto_review" | "active" | "blocked";

export type Driver = {
  id: string;
  name: string;
  /** Full number, "+998 90 123 45 67" (decision 2026-11-22: no masking in admin). */
  phone: string;
  cityId: string;
  carModel: string;
  carColor: string;
  carColorHex: string;
  plate: string;
  rating: number;
  totalTrips: number;
  online: boolean;
  walletBalance: number;
  /** How negative walletBalance may go before the driver is cut off. A
   * fixed company policy value, not something a screen computes. */
  debtLimit: number;
  status: DriverStatus;
  archived: boolean;
  avatarSeed: string;
  joinedAt: number;
};

export type PassengerStatus = "active" | "blocked";

export type Passenger = {
  id: string;
  name: string;
  /** Full number, "+998 90 123 45 67". */
  phone: string;
  rating: number;
  totalTrips: number;
  avatarSeed: string;
  cityId: string;
  status: PassengerStatus;
  archived: boolean;
  joinedAt: number;
};

export type OrderMode = "car" | "seat";
export type OrderStatus =
  | "completed"
  | "cancelled"
  | "in_progress"
  | "accepted"
  | "searching"
  | "no_driver";
export type PaymentMethod = "cash" | "card";

export type Order = {
  id: string;
  passengerId: string;
  driverId: string | null;
  fromCityId: string;
  toCityId: string;
  distanceKm: number;
  mode: OrderMode;
  seatIds: string[];
  price: number;
  paymentMethod: PaymentMethod;
  status: OrderStatus;
  createdAt: number;
  rating?: number;
  cancelReason?: string;
  note?: string;
  /** Requested pickup window, editable by admins who create/edit an order
   * on a passenger's behalf. Absent means "as soon as possible". */
  timeWindow?: { from: string; to: string };
  createdByAdminId?: string;
  /** Only present on orders created live during the demo session — lets the
   * mock server compute status transitions as a pure function of time
   * instead of needing timers/intervals. */
  timeline?: {
    searchResolvesAt: number;
    acceptedAt?: number;
    tripStartsAt?: number;
    tripEndsAt?: number;
    outcome: "accepted" | "no_driver";
  };
};

export type WalletEntryType = "cash" | "card" | "commission" | "topup" | "adjustment";
export type WalletEntry = {
  id: string;
  driverId: string;
  type: WalletEntryType;
  amount: number;
  orderId?: string;
  reason?: string;
  createdByAdminId?: string;
  createdByAdminName?: string;
  createdAt: number;
  balanceAfter: number;
};

export type ComplaintType =
  | "suspicious_gps"
  | "repeated_pair"
  | "otp_abuse"
  | "referral_abuse"
  | "service_quality"
  | "payment_dispute";

export type ComplaintNote = {
  id: string;
  text: string;
  authorId: string;
  authorName: string;
  createdAt: number;
};

export type ComplaintStatus = "open" | "reviewing" | "resolved" | "dismissed";

export type Complaint = {
  id: string;
  type: ComplaintType;
  orderId?: string;
  driverId?: string;
  passengerId?: string;
  status: ComplaintStatus;
  description: string;
  createdAt: number;
  assignedToId?: string;
  assignedToName?: string;
  notes: ComplaintNote[];
};

export const CITIES: City[] = [
  { id: "tsh", name: "Toshkent", region: "Toshkent shahri", lat: 41.2995, lng: 69.2401 },
  { id: "smq", name: "Samarqand", region: "Samarqand viloyati", lat: 39.6542, lng: 66.9597 },
  { id: "bxr", name: "Buxoro", region: "Buxoro viloyati", lat: 39.7747, lng: 64.4286 },
  { id: "and", name: "Andijon", region: "Andijon viloyati", lat: 40.7821, lng: 72.3442 },
  { id: "nmn", name: "Namangan", region: "Namangan viloyati", lat: 40.9983, lng: 71.6726 },
  { id: "frg", name: "Farg'ona", region: "Farg'ona viloyati", lat: 40.3864, lng: 71.7843 },
  { id: "qrs", name: "Qarshi", region: "Qashqadaryo viloyati", lat: 38.8606, lng: 65.7975 },
  { id: "nks", name: "Nukus", region: "Qoraqalpog'iston", lat: 42.46, lng: 59.6 },
  { id: "xva", name: "Xiva", region: "Xorazm viloyati", lat: 41.3783, lng: 60.3639 },
];

function haversineKm(a: City, b: City): number {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLng = ((b.lng - a.lng) * Math.PI) / 180;
  const sinLat = Math.sin(dLat / 2);
  const sinLng = Math.sin(dLng / 2);
  const h =
    sinLat * sinLat +
    Math.cos((a.lat * Math.PI) / 180) * Math.cos((b.lat * Math.PI) / 180) * sinLng * sinLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

export function roadDistanceKm(fromId: string, toId: string): number {
  const a = CITIES.find((c) => c.id === fromId)!;
  const b = CITIES.find((c) => c.id === toId)!;
  if (!a || !b || a.id === b.id) return 0;
  // Roads aren't straight lines — add a ~28% winding factor, round to 10km.
  const straight = haversineKm(a, b);
  return Math.round((straight * 1.28) / 10) * 10;
}

export const DEFAULT_TARIFF: Tariff = {
  id: "standard",
  name: "Standart",
  baseFare: 15000,
  perKmCar: 850,
  perKmSeat: 230,
  frontSeatSurcharge: 15000,
  fuelAdjustmentPct: 0,
  commissionPct: 10,
  archived: false,
};

export function roundPrice(v: number): number {
  return Math.round(v / 1000) * 1000;
}

export function computePrice(
  distanceKm: number,
  mode: OrderMode,
  seatIds: string[],
  tariff: Tariff = DEFAULT_TARIFF
): number {
  const fuelMult = 1 + tariff.fuelAdjustmentPct / 100;
  if (mode === "car") {
    return roundPrice((tariff.baseFare + tariff.perKmCar * distanceKm) * fuelMult);
  }
  const perSeatBase = tariff.baseFare / 3.5 + tariff.perKmSeat * distanceKm;
  const frontSurcharge = seatIds.includes("front") ? tariff.frontSeatSurcharge : 0;
  const seatCount = Math.max(seatIds.length, 1);
  return roundPrice((perSeatBase * seatCount + frontSurcharge) * fuelMult);
}

const MALE_NAMES = [
  "Jahongir", "Bexruz", "Sardor", "Aziz", "Davron", "Shoxrux", "Rustam",
  "Farrux", "Ulugbek", "Otabek", "Jasur", "Sherzod", "Bobur", "Islom",
  "Dilshod", "Murodjon", "Akmal", "Kamron", "Oybek", "Nodir", "Umidjon",
  "Xojiakbar", "Elyor", "Sanjar", "Diyorbek",
];
const FEMALE_NAMES = [
  "Nilufar", "Gulnoza", "Madina", "Sitora", "Zarina", "Dilnoza", "Shahnoza",
  "Malika", "Feruza", "Ozoda", "Kamola", "Mavluda", "Nargiza", "Lola",
];
const SURNAMES = [
  "Yusupov", "Qosimov", "Rahimov", "Tursunov", "Alimov", "Nazarov",
  "Ergashev", "Mirzayev", "Karimov", "Saidov", "Abdullayev", "Xolmatov",
  "Niyazov", "Sultonov", "Rashidov", "Juraev", "Botirov", "Islomov",
];
const FEMALE_SURNAME_SUFFIX = (s: string) => s.replace(/ov$/, "ova");

const CAR_MODELS = [
  { model: "Chevrolet Nexia 3", color: "Oq", hex: "#F4F6F5" },
  { model: "Chevrolet Cobalt", color: "Kumush", hex: "#C9CFCD" },
  { model: "Chevrolet Spark", color: "Qora", hex: "#1C2420" },
  { model: "Chevrolet Malibu 2", color: "Oq", hex: "#F4F6F5" },
  { model: "Chevrolet Captiva", color: "Kumush", hex: "#C9CFCD" },
  { model: "Lacetti", color: "Ko'k", hex: "#3B6FA0" },
  { model: "Lada Granta", color: "Oq", hex: "#F4F6F5" },
  { model: "Hyundai Sonata", color: "Qora", hex: "#1C2420" },
];

const COMPLAINT_TEMPLATES: Record<ComplaintType, string[]> = {
  suspicious_gps: [
    "Haydovchi GPS signali yo'l chizig'idan tashqarida sakrab turdi",
    "Buyurtma davomida joylashuv keskin uzilib qoldi",
  ],
  repeated_pair: [
    "Bir xil yo'lovchi-haydovchi juftligi qisqa vaqt ichida bir necha marta buyurtma berdi",
  ],
  otp_abuse: [
    "Bitta raqamga 10 daqiqada 6 marta tasdiqlash kodi so'ralgan",
  ],
  referral_abuse: [
    "Bir qurilmadan bir nechta referal hisob yaratilgani aniqlandi",
  ],
  service_quality: [
    "Yo'lovchi haydovchining kech kelganidan shikoyat qildi",
    "Mashina salonining tozaligi bo'yicha shikoyat",
  ],
  payment_dispute: [
    "To'lov summasi kelishilgan narxdan farq qilgani haqida shikoyat",
  ],
};

// Bump whenever the shape of persisted seed data changes, so a browser
// holding an old-shape localStorage snapshot gets a fresh reseed instead of
// crashing on missing/renamed fields.
export const SCHEMA_VERSION = 4;

export type SeedData = {
  schemaVersion: number;
  cities: City[];
  tariffs: Tariff[];
  drivers: Driver[];
  passengers: Passenger[];
  orders: Order[];
  walletEntries: WalletEntry[];
  complaints: Complaint[];
  generatedAt: number;
};

const SEED = 1_337_042;
const NOW = Date.UTC(2026, 10, 7, 9, 0, 0); // fixed reference "now" for deterministic relative dates

export function generateSeed(): SeedData {
  const rng = makeRng(SEED);
  const tariffs = [DEFAULT_TARIFF];

  const drivers: Driver[] = Array.from({ length: 12 }, (_, i) => {
    const name = `${rng.pick(MALE_NAMES)} ${rng.pick(SURNAMES)}`;
    const car = rng.pick(CAR_MODELS);
    const city = rng.pick(CITIES);
    const status = i < 10 ? "active" : rng.pick(["auto_review", "active", "blocked"] as const);
    return {
      id: `drv_${String(i + 1).padStart(2, "0")}`,
      name,
      // Sample numbers only: the "001" block keeps them obviously fake.
      phone: `+998 9${rng.int(0, 9)} 001 ${String(i + 1).padStart(2, "0")} ${String(rng.int(10, 99))}`,
      cityId: city.id,
      carModel: car.model,
      carColor: car.color,
      carColorHex: car.hex,
      plate: `${String(rng.int(1, 90)).padStart(2, "0")} ${rng.pick(["A", "B", "C", "H", "M"])} ${rng.int(100, 999)} ${rng.pick(["AA", "BB", "CC", "DD"])}`,
      rating: rng.float(4.5, 5.0, 1),
      totalTrips: rng.int(40, 820),
      online: rng.bool(0.5),
      walletBalance: rng.int(-20000, 480000),
      debtLimit: -50000,
      status,
      archived: i === 11,
      avatarSeed: `d${i}`,
      joinedAt: NOW - rng.int(30, 540) * 86_400_000,
    };
  });

  const passengers: Passenger[] = Array.from({ length: 30 }, (_, i) => {
    const isFemale = rng.bool(0.4);
    const name = isFemale
      ? `${rng.pick(FEMALE_NAMES)} ${FEMALE_SURNAME_SUFFIX(rng.pick(SURNAMES))}`
      : `${rng.pick(MALE_NAMES)} ${rng.pick(SURNAMES)}`;
    return {
      id: `pax_${String(i + 1).padStart(2, "0")}`,
      name,
      phone: `+998 9${rng.int(0, 9)} 002 ${String(i + 1).padStart(2, "0")} ${String(rng.int(10, 99))}`,
      rating: rng.float(4.3, 5.0, 1),
      totalTrips: rng.int(1, 140),
      avatarSeed: `p${i}`,
      cityId: rng.pick(CITIES).id,
      status: i === 2 ? "blocked" : "active",
      archived: i === 29,
      joinedAt: NOW - rng.int(1, 400) * 86_400_000,
    };
  });

  const ORDER_STATUSES: OrderStatus[] = [
    "completed", "completed", "completed", "completed", "completed",
    "completed", "completed", "cancelled", "cancelled", "no_driver",
  ];

  const orders: Order[] = Array.from({ length: 60 }, (_, i) => {
    const from = rng.pick(CITIES);
    let to = rng.pick(CITIES);
    while (to.id === from.id) to = rng.pick(CITIES);
    const distanceKm = roadDistanceKm(from.id, to.id);
    const mode: OrderMode = rng.bool(0.55) ? "car" : "seat";
    const seatIds = mode === "seat" ? rng.shuffle(["front", "back-left", "back-mid", "back-right"]).slice(0, rng.int(1, 2)) : [];
    const status = rng.pick(ORDER_STATUSES);
    const driverId = status === "no_driver" ? null : rng.pick(drivers).id;
    return {
      id: `ord_${String(i + 1).padStart(3, "0")}`,
      passengerId: rng.pick(passengers).id,
      driverId,
      fromCityId: from.id,
      toCityId: to.id,
      distanceKm,
      mode,
      seatIds,
      price: computePrice(distanceKm, mode, seatIds),
      paymentMethod: rng.bool(0.6) ? "cash" : "card",
      status,
      createdAt: NOW - rng.int(0, 45) * 86_400_000 - rng.int(0, 86_399) * 1000,
      rating: status === "completed" ? rng.int(4, 5) : undefined,
      cancelReason: status === "cancelled" ? rng.pick([
        "Reja o'zgardi", "Juda uzoq kutdim", "Narxni qayta ko'rib chiqdim", "Boshqa yo'l tanladim",
      ]) : undefined,
    };
  });

  const walletEntries: WalletEntry[] = [];
  for (const driver of drivers) {
    let balance = 0;
    const entryCount = rng.int(6, 14);
    for (let i = 0; i < entryCount; i++) {
      const type: WalletEntryType = rng.pick(["cash", "card", "commission", "topup"]);
      let amount = 0;
      if (type === "cash") amount = rng.int(40, 180) * 1000;
      if (type === "card") amount = rng.int(40, 180) * 1000;
      if (type === "commission") amount = -rng.int(4, 18) * 1000;
      if (type === "topup") amount = rng.int(50, 300) * 1000;
      balance += amount;
      walletEntries.push({
        id: `wal_${driver.id}_${i}`,
        driverId: driver.id,
        type,
        amount,
        createdAt: NOW - rng.int(0, 30) * 86_400_000,
        balanceAfter: balance,
      });
    }
    driver.walletBalance = balance;
  }

  const complaints: Complaint[] = Array.from({ length: 11 }, (_, i) => {
    const type = rng.pick(Object.keys(COMPLAINT_TEMPLATES) as ComplaintType[]);
    const order = rng.pick(orders);
    return {
      id: `cmp_${String(i + 1).padStart(2, "0")}`,
      type,
      orderId: order.id,
      driverId: order.driverId ?? undefined,
      passengerId: order.passengerId,
      status: rng.pick(["open", "reviewing", "resolved", "dismissed"]),
      description: rng.pick(COMPLAINT_TEMPLATES[type]),
      createdAt: NOW - rng.int(0, 20) * 86_400_000,
      notes: [],
    };
  });

  return {
    schemaVersion: SCHEMA_VERSION,
    cities: CITIES,
    tariffs,
    drivers,
    passengers,
    orders,
    walletEntries,
    complaints,
    generatedAt: NOW,
  };
}
