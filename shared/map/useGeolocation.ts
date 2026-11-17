import { useEffect, useRef, useState } from "react";
import { distanceM, isLatLng, type LatLng } from "./geo.ts";

/** Fixes closer than this to the last one don't re-render the map. */
const MIN_MOVE_M = 5;

/**
 * The device's position (GPS), updated as it moves; null until the first
 * fix, when permission is refused or when `enabled` is false.
 *
 * `simulated`: a known position to use instead of the GPS — sample-data
 * mode passes its mock coordinates here, so the demo never asks for the
 * location permission.
 */
export function useGeolocation(opts: { enabled?: boolean; simulated?: LatLng | null } = {}): LatLng | null {
  const enabled = opts.enabled ?? true;
  const simulated = opts.simulated && isLatLng(opts.simulated) ? opts.simulated : null;
  const useGps = enabled && !simulated;
  const [fix, setFix] = useState<LatLng | null>(null);

  useEffect(() => {
    if (!useGps || typeof navigator === "undefined" || !navigator.geolocation) return;
    const id = navigator.geolocation.watchPosition(
      (pos) => {
        const next = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        if (!isLatLng(next)) return;
        setFix((prev) => (prev && distanceM(prev, next) < MIN_MOVE_M ? prev : next));
      },
      () => {
        /* refused or unavailable: the map simply has no "you are here" dot */
      },
      { enableHighAccuracy: true, maximumAge: 10_000, timeout: 20_000 }
    );
    return () => navigator.geolocation.clearWatch(id);
  }, [useGps]);

  if (!enabled) return null;
  return simulated ?? fix;
}

/**
 * `point`, but it changes only after moving at least `minMoveM` from the
 * value last returned. For work that shouldn't repeat on every GPS fix —
 * e.g. asking Mapbox for a route from a moving car.
 */
export function useCoarsePoint(point: LatLng | null, minMoveM: number): LatLng | null {
  const held = useRef<LatLng | null>(null);
  if (!point) held.current = null;
  else if (!held.current || distanceM(held.current, point) >= minMoveM) held.current = point;
  return held.current;
}
