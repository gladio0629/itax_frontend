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
  /** Marketplace warehouse (Kargo "Marketpleysga" drop-offs only). */
  warehouse?: { marketplace: string };
};

// Appended points keep the earlier ids and map positions unchanged (ids are
// by index, positions come from a per-city sequence). Four points per city
// let a Kargo "Shahar ichi" route have a pickup and several drop-offs.
const POINT_SUFFIXES = ["Avtovokzal", "Markaziy bozor", "Temir yo'l vokzali", "Shahar markazi"];

function hashSeed(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) | 0;
  return h >>> 0;
}

export const ADDRESSES: Address[] = CITIES.flatMap((city) => {
  const rng = makeRng(hashSeed(city.id));
  return POINT_SUFFIXES.map((suffix, i) => ({
    id: `${city.id}-${i + 1}`,
    cityId: city.id,
    label: `${city.name} — ${suffix}`,
    x: rng.int(15, 85),
    y: rng.int(15, 85),
  }));
});

/** Mock marketplace warehouses — kept out of ADDRESSES so search, the map
 * pin and defaults never offer them; only the warehouse list does. */
export const WAREHOUSES: Address[] = [
  { id: "wh-uzum-tsh", cityId: "tsh", label: "Uzum Market — Toshkent ombori", x: 30, y: 62, warehouse: { marketplace: "Uzum Market" } },
  { id: "wh-wb-tsh", cityId: "tsh", label: "Wildberries — Toshkent ombori", x: 68, y: 40, warehouse: { marketplace: "Wildberries" } },
  { id: "wh-yandex-tsh", cityId: "tsh", label: "Yandex Market — Toshkent ombori", x: 52, y: 78, warehouse: { marketplace: "Yandex Market" } },
  { id: "wh-uzum-smq", cityId: "smq", label: "Uzum Market — Samarqand ombori", x: 44, y: 30, warehouse: { marketplace: "Uzum Market" } },
  { id: "wh-wb-and", cityId: "and", label: "Wildberries — Andijon ombori", x: 60, y: 55, warehouse: { marketplace: "Wildberries" } },
];

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
