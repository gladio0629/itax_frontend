// Everything that talks to Mapbox, in one lazily loaded chunk: the map
// library and the Directions request. The only file under shared/map that
// may import mapbox-gl or call fetch (scripts/check-no-network.mjs).
import mapboxgl from "mapbox-gl";
import { createDirections, type Directions } from "./directions.ts";
import type { LatLng } from "./geo.ts";
import type { RouteResult } from "./route.ts";

export { mapboxgl };

const clients = new Map<string, Directions>();

export function route(token: string, points: readonly LatLng[], signal?: AbortSignal): Promise<RouteResult> {
  let client = clients.get(token);
  if (!client) {
    client = createDirections({
      token,
      // A plain cross-origin GET: no cookies, no IZGO session headers.
      fetchImpl: (url, init) => fetch(url, { signal: init.signal, credentials: "omit" }),
    });
    clients.set(token, client);
  }
  return client.route(points, signal);
}
