// What the map code needs from Mapbox. Which provider file a build gets is
// decided at build time by the `@map-provider` alias (shared/vite/izgo.ts):
// provider.mapbox.ts when VITE_MAPBOX_TOKEN is set, provider.none.ts when
// it isn't — so a build without a token contains no Mapbox code at all.
import type { LatLng } from "./geo.ts";
import type { RouteResult } from "./route.ts";

// Type-only views of mapbox-gl (erased at build time), so no other file
// needs to name the package.
export type MapboxGL = typeof import("mapbox-gl").default;
export type MapboxMap = import("mapbox-gl").Map;
export type MapboxMarker = import("mapbox-gl").Marker;
export type MapboxGeoJSONSource = import("mapbox-gl").GeoJSONSource;

export type MapRuntime = {
  mapboxgl: MapboxGL;
  /** Road route through the points; never rejects (straight line on failure). */
  route(token: string, points: readonly LatLng[], signal?: AbortSignal): Promise<RouteResult>;
};

export type MapProvider = {
  /** Loads mapbox-gl on first use (its own chunk). null: no map in this build. */
  load: (() => Promise<MapRuntime>) | null;
};
