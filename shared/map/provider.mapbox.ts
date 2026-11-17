// The `@map-provider` of a build that has VITE_MAPBOX_TOKEN. mapbox-gl and
// the Directions call live in mapboxRuntime.ts, loaded only when a map is
// first shown, so they stay out of the app's start-up bundle.
import "mapbox-gl/dist/mapbox-gl.css";
import type { MapProvider } from "./provider.types.ts";

export const provider: MapProvider = { load: () => import("./mapboxRuntime.ts") };
