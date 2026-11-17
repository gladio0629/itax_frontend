// A drawn route, whatever produced it. Kept apart from directions.ts so a
// build without Mapbox carries none of its code.
import { distanceM, isLatLng, type LatLng } from "./geo.ts";

export type RouteResult = {
  /** The line to draw, start to end. */
  path: LatLng[];
  distanceM: number;
  durationS: number;
  /** "straight": Mapbox was unavailable, the points are joined directly. */
  source: "mapbox" | "straight";
};

/** The points joined directly: what is drawn when Mapbox can't be reached. */
export function straightRoute(points: readonly LatLng[]): RouteResult {
  const path = points.filter(isLatLng);
  let distance = 0;
  for (let i = 1; i < path.length; i++) distance += distanceM(path[i - 1], path[i]);
  return { path, distanceM: distance, durationS: 0, source: "straight" };
}
