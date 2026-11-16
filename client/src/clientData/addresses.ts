// Client-only pickup/drop-off point layer on top of the shared (unchanged)
// City list, so "Qayerdan"/"Qayerga" can show map pins and a short label
// instead of a bare city name, while pricing still resolves to a city pair
// exactly as before (see mock.ts). Deterministic, not persisted — doesn't
// need a schema version guard.
import { CITIES } from "@/seed/generate";
import { makeRng } from "@/lib/prng";

export type Address = {
  id: string;
  cityId: string;
  label: string;
  /** 0-100 position on the fake map, deterministic per address. */
  x: number;
  y: number;
  /** Mock coordinates for the real map: the fake-map position laid over
   * the city (50, 50 = the city's centre). */
  lat: number;
  lng: number;
  /** Marketplace warehouse (Kargo "Marketpleysga" drop-offs only). */
  warehouse?: { marketplace: string };
};

// Appended points keep the earlier ids and map positions unchanged (ids are
// by index, positions come from a per-city sequence). Four points per city
// let a Kargo "Shahar ichi" route have a pickup and several drop-offs.
const POINT_SUFFIXES = ["Avtovokzal", "Markaziy bozor", "Temir yo'l vokzali", "Shahar markazi"];

/** Degrees per fake-map unit: the 0–100 square covers about 6 × 6 km. */
const LAT_PER_UNIT = 0.00054;
const LNG_PER_UNIT = 0.00072;

/** Mock coordinates of a fake-map position in a city (y grows downwards). */
export function mockCoords(cityId: string, x: number, y: number): { lat: number; lng: number } {
  const city = CITIES.find((c) => c.id === cityId) ?? CITIES[0];
  return { lat: +(city.lat + (50 - y) * LAT_PER_UNIT).toFixed(6), lng: +(city.lng + (x - 50) * LNG_PER_UNIT).toFixed(6) };
}

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h >>> 0;
}

export const ADDRESSES: Address[] = CITIES.flatMap((city) => {
  const rng = makeRng(hashSeed(city.id));
  return POINT_SUFFIXES.map((suffix, i) => {
    const x = rng.int(15, 85);
    const y = rng.int(15, 85);
    return { id: `${city.id}-${i + 1}`, cityId: city.id, label: `${city.name} — ${suffix}`, x, y, ...mockCoords(city.id, x, y) };
  });
});

/** Mock marketplace warehouses — kept out of ADDRESSES so search, the map
 * pin and defaults never offer them; only the warehouse list does. */
export const WAREHOUSES: Address[] = [
  { id: "wh-uzum-tsh", cityId: "tsh", label: "Uzum Market — Toshkent ombori", x: 30, y: 62, warehouse: { marketplace: "Uzum Market" } },
  { id: "wh-wb-tsh", cityId: "tsh", label: "Wildberries — Toshkent ombori", x: 68, y: 40, warehouse: { marketplace: "Wildberries" } },
  { id: "wh-yandex-tsh", cityId: "tsh", label: "Yandex Market — Toshkent ombori", x: 52, y: 78, warehouse: { marketplace: "Yandex Market" } },
  { id: "wh-uzum-smq", cityId: "smq", label: "Uzum Market — Samarqand ombori", x: 44, y: 30, warehouse: { marketplace: "Uzum Market" } },
  { id: "wh-wb-and", cityId: "and", label: "Wildberries — Andijon ombori", x: 60, y: 55, warehouse: { marketplace: "Wildberries" } },
].map((w) => ({ ...w, ...mockCoords(w.cityId, w.x, w.y) }));

export function addressById(id: string): Address | undefined {
  return ADDRESSES.find((a) => a.id === id) ?? WAREHOUSES.find((a) => a.id === id);
}

export function addressesForQuery(query: string, excludeCityId?: string, onlyCityId?: string): Address[] {
  const q = query.trim().toLowerCase();
  return ADDRESSES.filter(
    (a) =>
      a.cityId !== excludeCityId &&
      (!onlyCityId || a.cityId === onlyCityId) &&
      (!q || a.label.toLowerCase().includes(q))
  ).slice(0, 12);
}

export function defaultAddressesForCity(cityId: string): Address[] {
  return ADDRESSES.filter((a) => a.cityId === cityId);
}

// Seeded "saved" addresses for the demo passenger — deliberately in cities
// other than the default Toshkent pickup, so tapping one from Home always
// resolves to a valid (non-zero-distance) intercity route.
const SAVED_ADDRESS_IDS = ["smq-1", "frg-2", "bxr-1"];

export function savedAddresses(): Address[] {
  return SAVED_ADDRESS_IDS.map((id) => addressById(id)).filter((a): a is Address => !!a);
}

export function nearestAddress(x: number, y: number, excludeCityId?: string, onlyCityId?: string): Address {
  let best = ADDRESSES[0];
  let bestD = Infinity;
  for (const a of ADDRESSES) {
    if (a.cityId === excludeCityId) continue;
    if (onlyCityId && a.cityId !== onlyCityId) continue;
    const d = (a.x - x) ** 2 + (a.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}
