// Mapbox Directions client (driving profile), called straight from the
// browser. Pure: the network function is passed in, so this file makes no
// request of its own and runs under `node --test`. The real binding is in
// mapboxRuntime.ts, the only map file allowed to reach the network.
//
// The request carries the public Mapbox token only — never the IZGO session
// (it does not go through shared/http).
import { isLatLng, pathLengthM, pointsKey, type LatLng } from "./geo.ts";
import { straightRoute, type RouteResult } from "./route.ts";

export const MAPBOX_DIRECTIONS_URL = "https://api.mapbox.com/directions/v5/mapbox/driving/";

/** The part of the browser's fetch that createDirections uses. */
export type FetchLike = (url: string, init: { signal?: AbortSignal }) => Promise<{ ok: boolean; status: number; json(): Promise<unknown> }>;

const coord = (p: LatLng) => `${p.lng.toFixed(6)},${p.lat.toFixed(6)}`;

/** {lon1},{lat1};{lon2},{lat2}[;…] — Mapbox takes longitude first. */
export function directionsUrl(points: readonly LatLng[], token: string): string {
  const query = new URLSearchParams({ geometries: "geojson", overview: "full", access_token: token });
  return `${MAPBOX_DIRECTIONS_URL}${points.map(coord).join(";")}?${query.toString()}`;
}

/** routes[0] of a Directions response; null when it has no usable route. */
export function parseDirections(body: unknown): RouteResult | null {
  if (!body || typeof body !== "object") return null;
  const { code, routes } = body as { code?: unknown; routes?: unknown };
  if (code !== "Ok" || !Array.isArray(routes) || routes.length === 0) return null;
  const route = routes[0] as { distance?: unknown; duration?: unknown; geometry?: { coordinates?: unknown } };
  const raw = route?.geometry?.coordinates;
  if (!Array.isArray(raw)) return null;
  const path: LatLng[] = [];
  for (const c of raw) {
    if (!Array.isArray(c)) return null;
    const p = { lng: c[0] as number, lat: c[1] as number };
    if (!isLatLng(p)) return null;
    path.push(p);
  }
  if (path.length < 2) return null;
  const distance = typeof route.distance === "number" && route.distance >= 0 ? route.distance : pathLengthM(path);
  const duration = typeof route.duration === "number" && route.duration >= 0 ? route.duration : 0;
  return { path, distanceM: distance, durationS: duration, source: "mapbox" };
}

export type Directions = {
  /** Never rejects: any failure (offline, bad token, no road) gives the
   * straight line. An aborted call resolves the same way. */
  route(points: readonly LatLng[], signal?: AbortSignal): Promise<RouteResult>;
};

export function createDirections(opts: { token: string; fetchImpl: FetchLike; timeoutMs?: number; cacheSize?: number }): Directions {
  const timeoutMs = opts.timeoutMs ?? 8000;
  const cacheSize = opts.cacheSize ?? 24;
  // Screens re-ask for the same route on every render cycle and reopen:
  // one request per distinct route, shared while it is in flight.
  const cache = new Map<string, Promise<RouteResult>>();

  async function request(points: LatLng[]): Promise<RouteResult> {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await opts.fetchImpl(directionsUrl(points, opts.token), { signal: controller.signal });
      if (!res.ok) return straightRoute(points);
      return parseDirections(await res.json()) ?? straightRoute(points);
    } catch {
      return straightRoute(points);
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    route(points, signal) {
      const usable = points.filter(isLatLng);
      // Mapbox accepts 2–25 waypoints; anything else has no road route.
      if (usable.length < 2 || usable.length !== points.length || usable.length > 25 || !opts.token) {
        return Promise.resolve(straightRoute(usable));
      }
      const key = pointsKey(usable);
      let hit = cache.get(key);
      if (!hit) {
        hit = request(usable);
        cache.set(key, hit);
        // A failed lookup isn't kept: the next ask tries Mapbox again.
        hit.then((r) => {
          if (r.source !== "mapbox" && cache.get(key) === hit) cache.delete(key);
        });
        if (cache.size > cacheSize) cache.delete(cache.keys().next().value as string);
      }
      if (!signal) return hit;
      return new Promise<RouteResult>((resolve) => {
        if (signal.aborted) return resolve(straightRoute(usable));
        signal.addEventListener("abort", () => resolve(straightRoute(usable)), { once: true });
        void hit.then(resolve);
      });
    },
  };
}
