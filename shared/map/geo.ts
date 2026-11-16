// Map geometry shared by the client and driver apps. Pure functions, no
// packages and no network, so it also runs under `node --test`.
// Screens use { lat, lng }; Mapbox wants [lng, lat] — convert with toLngLat().

export type LatLng = { lat: number; lng: number };

/** Default map centre: Tashkent (Mapbox order: [69.2401, 41.2995]). */
export const TASHKENT: LatLng = { lat: 41.2995, lng: 69.2401 };

const EARTH_RADIUS_M = 6_371_000;
const RAD = Math.PI / 180;

export function isLatLng(v: unknown): v is LatLng {
  if (!v || typeof v !== "object") return false;
  const { lat, lng } = v as { lat?: unknown; lng?: unknown };
  return (
    typeof lat === "number" && typeof lng === "number" && Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180
  );
}

/** A point from loosely typed data (an API object, a WebSocket frame whose
 * values are strings); null when it isn't a usable coordinate. */
export function toLatLng(lat: unknown, lng: unknown): LatLng | null {
  const read = (v: unknown) => (typeof v === "number" ? v : typeof v === "string" && v.trim() !== "" ? Number(v) : NaN);
  const p = { lat: read(lat), lng: read(lng) };
  return isLatLng(p) ? p : null;
}

export const toLngLat = (p: LatLng): [number, number] => [p.lng, p.lat];

/** Great-circle distance in metres (same formula as the backend's shared/geo). */
export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = (b.lat - a.lat) * RAD;
  const dLng = (b.lng - a.lng) * RAD;
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * RAD) * Math.cos(b.lat * RAD) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

export function pathLengthM(path: readonly LatLng[]): number {
  let total = 0;
  for (let i = 1; i < path.length; i++) total += distanceM(path[i - 1], path[i]);
  return total;
}

/** The point `fraction` (0…1, by distance) of the way along a path. */
export function pointAlong(path: readonly LatLng[], fraction: number): LatLng | null {
  if (path.length === 0) return null;
  if (path.length === 1) return path[0];
  const f = Number.isFinite(fraction) ? Math.min(1, Math.max(0, fraction)) : 0;
  if (f <= 0) return path[0];
  if (f >= 1) return path[path.length - 1];
  const target = pathLengthM(path) * f;
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    const seg = distanceM(path[i - 1], path[i]);
    if (walked + seg >= target && seg > 0) {
      const t = Math.min(1, (target - walked) / seg);
      return { lat: path[i - 1].lat + (path[i].lat - path[i - 1].lat) * t, lng: path[i - 1].lng + (path[i].lng - path[i - 1].lng) * t };
    }
    walked += seg;
  }
  return path[path.length - 1];
}

/** The part of a path from `fraction` to its end (what is still to drive). */
export function pathFrom(path: readonly LatLng[], fraction: number): LatLng[] {
  const start = pointAlong(path, fraction);
  if (!start || path.length < 2) return [...path];
  const f = Math.min(1, Math.max(0, Number.isFinite(fraction) ? fraction : 0));
  if (f <= 0) return [...path];
  if (f >= 1) return [start];
  const target = pathLengthM(path) * f;
  let walked = 0;
  for (let i = 1; i < path.length; i++) {
    walked += distanceM(path[i - 1], path[i]);
    if (walked > target) return [start, ...path.slice(i)];
  }
  return [start];
}

/** A point `eastM` / `northM` metres away (small offsets only). */
export function offsetPoint(origin: LatLng, eastM: number, northM: number): LatLng {
  const lat = origin.lat + northM / EARTH_RADIUS_M / RAD;
  const lng = origin.lng + eastM / (EARTH_RADIUS_M * Math.cos(origin.lat * RAD)) / RAD;
  return { lat, lng };
}

/** [[west, south], [east, north]] around the points; null when there are none. */
export function boundsOf(points: readonly LatLng[]): [[number, number], [number, number]] | null {
  const ok = points.filter(isLatLng);
  if (ok.length === 0) return null;
  let w = ok[0].lng;
  let e = ok[0].lng;
  let s = ok[0].lat;
  let n = ok[0].lat;
  for (const p of ok) {
    w = Math.min(w, p.lng);
    e = Math.max(e, p.lng);
    s = Math.min(s, p.lat);
    n = Math.max(n, p.lat);
  }
  return [
    [w, s],
    [e, n],
  ];
}

/** Stable text for "did these points change" checks (≈1 m precision). */
export function pointsKey(points: readonly (LatLng | null | undefined)[]): string {
  return points.map((p) => (p && isLatLng(p) ? `${p.lat.toFixed(5)},${p.lng.toFixed(5)}` : "-")).join(";");
}
