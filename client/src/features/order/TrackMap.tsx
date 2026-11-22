import { useEffect, useState, type ReactNode } from "react";
import { api } from "@/api/client";
import type { DriverLocation, OrderWithDetails } from "@/api/types";
import { LiveMap } from "@/components/LiveMap";
import { MAPBOX_TOKEN } from "@/config";
import { useT } from "@/lib/i18n/provider";
import { pathFrom, pointAlong, type LatLng } from "@shared/map/geo";
import { useRoute } from "@shared/map/useRoute";
import type { MapMarker, MapRoute } from "@shared/map/MapView";
import { orderPoint } from "./mapPoints";

/** How far along the car is, for the drawn map (sample data only). */
export type DrawnProgress = { leg: "to_pickup" | "trip"; fraction: number } | null;

/**
 * An order on the map: pickup, drop-off, the road route and — while a
 * driver is assigned — the car, moving as its position arrives
 * (api.onDriverLocation: the server's push, or the sample data's simulated
 * drive). Fills its parent. `fallback` may take the car's progress so the
 * drawn map can show it too.
 */
export function TrackMap({
  order,
  interactive = true,
  fallback,
  padding = { top: 8, bottom: 8 },
  fullScreen,
}: {
  order: OrderWithDetails;
  interactive?: boolean;
  fallback: ReactNode | ((progress: DrawnProgress) => ReactNode);
  padding?: { top: number; bottom: number };
  /** The map is the whole screen: one-finger panning, no gesture hint. */
  fullScreen?: boolean;
}) {
  const { t } = useT();
  const from = orderPoint(order, "from");
  const to = orderPoint(order, "to");
  const trip = useRoute(MAPBOX_TOKEN, [from, to]);

  const tracking = interactive && (order.status === "accepted" || order.status === "in_progress");
  const [location, setLocation] = useState<DriverLocation | null>(null);
  useEffect(() => {
    setLocation(null);
    if (!tracking) return;
    return api.onDriverLocation(order.id, setLocation);
  }, [order.id, tracking]);

  // Sample data: the car drives from its start to the pickup along a road.
  const start = location?.kind === "progress" ? location.start : null;
  const approach = useRoute(MAPBOX_TOKEN, [start, from]);

  let car: LatLng | null = null;
  let approachAhead: LatLng[] = [];
  if (location?.kind === "position") {
    car = { lat: location.lat, lng: location.lng };
  } else if (location?.kind === "progress" && from && to) {
    if (location.leg === "to_pickup") {
      const path = approach?.path ?? [location.start, from];
      car = pointAlong(path, location.fraction);
      approachAhead = pathFrom(path, location.fraction);
    } else {
      car = pointAlong(trip?.path ?? [from, to], location.fraction);
    }
  }

  const markers: MapMarker[] = [];
  if (from) markers.push({ id: "from", position: from, kind: "pickup" });
  if (to) markers.push({ id: "to", position: to, kind: "dropoff" });
  if (car) markers.push({ id: "car", position: car, kind: "driver", animate: true });

  const routes: MapRoute[] = [];
  if (trip) routes.push({ id: "trip", path: trip.path });
  if (approachAhead.length >= 2) routes.push({ id: "approach", path: approachAhead, dashed: true, width: 4 });

  // On the way to the pickup the map shows the car and the pickup; otherwise
  // the whole trip. Refit only when that changes, not on every car move.
  const toPickup = order.status === "accepted" && !!car;
  return (
    <LiveMap
      className="absolute inset-0"
      ariaLabel={t("map.routeLabel")}
      interactive={interactive}
      cooperativeGestures={!fullScreen}
      markers={markers}
      routes={routes}
      fit={toPickup ? [car, from] : [from, to]}
      fitKey={`${order.id}:${toPickup ? "pickup" : "trip"}:${from ? 1 : 0}${to ? 1 : 0}:${padding.bottom}`}
      padding={padding}
      fallback={typeof fallback === "function" ? fallback(location?.kind === "progress" ? { leg: location.leg, fraction: location.fraction } : null) : fallback}
    />
  );
}
