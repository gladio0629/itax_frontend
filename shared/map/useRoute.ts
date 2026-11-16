import { useEffect, useState } from "react";
import { provider } from "@map-provider";
import { isLatLng, pointsKey, type LatLng } from "./geo.ts";
import { straightRoute, type RouteResult } from "./route.ts";

/**
 * The route through `points` (2–25): the road line from Mapbox Directions,
 * or a straight line when Mapbox is off or unreachable. null while a point
 * is missing or the answer is still on its way. Recomputed only when a
 * point really moves.
 */
export function useRoute(token: string, points: readonly (LatLng | null | undefined)[]): RouteResult | null {
  const complete = points.length >= 2 && points.every((p) => !!p && isLatLng(p));
  const key = complete ? pointsKey(points) : "";
  const [state, setState] = useState<{ key: string; route: RouteResult } | null>(null);

  useEffect(() => {
    if (!key) return;
    const usable = points as LatLng[];
    if (!provider.load || !token) {
      setState({ key, route: straightRoute(usable) });
      return;
    }
    let live = true;
    const ctl = new AbortController();
    provider
      .load()
      .then((rt) => rt.route(token, usable, ctl.signal))
      .catch(() => straightRoute(usable))
      .then((route) => {
        if (live) setState({ key, route });
      });
    return () => {
      live = false;
      ctl.abort();
    };
    // `points` is read through `key` (its value), not its identity.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [key, token]);

  return key && state?.key === key ? state.route : null;
}
