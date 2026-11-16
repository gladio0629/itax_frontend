// The `@map-provider` of a build without VITE_MAPBOX_TOKEN: no Mapbox code,
// no network. <MapView /> shows its `fallback` (the drawn map).
import type { MapProvider } from "./provider.types.ts";

export const provider: MapProvider = { load: null };
