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
};

const POINT_SUFFIXES = ["Avtovokzal", "Markaziy bozor"];

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

export function addressById(id: string): Address | undefined {
  return ADDRESSES.find((a) => a.id === id);
}

export function addressesForQuery(query: string, excludeCityId?: string): Address[] {
  const q = query.trim().toLowerCase();
  return ADDRESSES.filter(
    (a) => a.cityId !== excludeCityId && (!q || a.label.toLowerCase().includes(q))
  ).slice(0, 12);
}

export function defaultAddressesForCity(cityId: string): Address[] {
  return ADDRESSES.filter((a) => a.cityId === cityId);
}

export function nearestAddress(x: number, y: number, excludeCityId?: string): Address {
  let best = ADDRESSES[0];
  let bestD = Infinity;
  for (const a of ADDRESSES) {
    if (a.cityId === excludeCityId) continue;
    const d = (a.x - x) ** 2 + (a.y - y) ** 2;
    if (d < bestD) {
      bestD = d;
      best = a;
    }
  }
  return best;
}
