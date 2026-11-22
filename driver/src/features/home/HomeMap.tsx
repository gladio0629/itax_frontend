import { api } from "@/api/client";
import type { AcceptedPage, Booking, Place } from "@/api/types";
import { LiveMap, LIVE_MAP } from "@/components/LiveMap";
import { MAPBOX_TOKEN } from "@/config";
import { isLatLng, type LatLng } from "@shared/map/geo";
import type { MapMarker, MapPadding, MapRoute } from "@shared/map/MapView";
import { useCoarsePoint, useGeolocation } from "@shared/map/useGeolocation";
import { useRoute } from "@shared/map/useRoute";
import { DriverMap } from "./DriverMap";

/** The route to the pickup is re-asked only after the car has moved this far. */
const REROUTE_AFTER_M = 200;
const STAGE_RANK = { in_progress: 0, waiting: 1, to_pickup: 2, completed: 3 } as const;

/** The accepted trip the map is about: the one under way, else the nearest pickup. */
export function tripInFocus(page: AcceptedPage | undefined): Booking | null {
  const all = (page?.days ?? []).flatMap((d) => d.trips.flatMap((trip) => trip.bookings.map((b) => ({ b, day: d.dayOffset }))));
  const open = all.filter((x) => x.b.stage !== "completed");
  open.sort((x, y) => STAGE_RANK[x.b.stage] - STAGE_RANK[y.b.stage] || x.day - y.day || x.b.acceptedAt - y.b.acceptedAt);
  return open[0]?.b ?? null;
}

function pointOf(place: Place | undefined): LatLng | null {
  const p = { lat: place?.lat, lng: place?.lng };
  return isLatLng(p) ? p : null;
}

/**
 * The home screen's full-screen map: where the driver is and — once a
 * request is accepted — the road to the passenger and on to the
 * destination. The drawn night-city map is the fallback (no Mapbox token
 * in the build, no WebGL, offline).
 */
export function HomeMap({
  label,
  routeLabel,
  accepted,
  padding,
  refit,
}: {
  label: string;
  /** Screen-reader label once a trip's route is shown. */
  routeLabel: string;
  accepted: AcceptedPage | undefined;
  padding?: MapPadding;
  /** Changing it brings the camera back (the "recentre" button). */
  refit: number;
}) {
  // GPS on the real backend; the sample data's mock coordinates otherwise.
  const me = useGeolocation({ enabled: LIVE_MAP, simulated: api.simulatedPosition() });
  const booking = tripInFocus(accepted);
  const pickup = pointOf(booking?.pickup);
  const dropoff = pointOf(booking?.dropoff);
  const toPickup = booking?.stage === "to_pickup";

  // To the passenger: from the car, re-asked as it moves. To the
  // destination: one route for the whole trip (the car then drives along it).
  const origin = useCoarsePoint(toPickup ? me : null, REROUTE_AFTER_M);
  const approach = useRoute(MAPBOX_TOKEN, [origin, toPickup ? pickup : null]);
  const trip = useRoute(MAPBOX_TOKEN, [pickup, dropoff]);

  const routes: MapRoute[] = [];
  // While heading to the pickup the trip itself stays in the background.
  if (trip) routes.push({ id: "trip", path: trip.path, ...(toPickup ? { opacity: 0.45, width: 4 } : {}) });
  if (toPickup && approach) routes.push({ id: "approach", path: approach.path });

  const markers: MapMarker[] = [];
  if (pickup) markers.push({ id: "pickup", position: pickup, kind: "pickup" });
  if (dropoff) markers.push({ id: "dropoff", position: dropoff, kind: "dropoff" });
  if (me) {
    markers.push({
      id: "me",
      position: me,
      kind: "driver",
      animate: true,
      // The same marker as on the drawn map.
      content: (
        <span className="relative block h-7 w-7 rounded-full bg-white shadow-2">
          <span className="absolute inset-[5px] rounded-full bg-brand" />
        </span>
      ),
    });
  }

  // What to keep in view: the way to the passenger, then the trip.
  const fit = !booking ? [me] : toPickup ? [me, pickup] : booking.stage === "waiting" ? [pickup, dropoff] : [me ?? pickup, dropoff];
  return (
    <LiveMap
      className="absolute inset-0"
      ariaLabel={booking ? routeLabel : label}
      center={me}
      zoom={14}
      markers={markers}
      routes={routes}
      fit={fit}
      // Not on every GPS fix: when the trip or its stage changes, when the
      // first position arrives, or on "recentre".
      fitKey={`${booking?.id ?? "idle"}:${booking?.stage ?? ""}:${me ? 1 : 0}${pickup ? 1 : 0}${dropoff ? 1 : 0}:${refit}`}
      padding={padding}
      // The drawn map is composed for the visible part only (its driver
      // marker sits in the middle of it), so it stops where the feed begins.
      fallback={
        <div className="absolute inset-x-0 top-0" style={{ bottom: padding?.bottom ?? 0 }}>
          <DriverMap label={label} />
        </div>
      }
    />
  );
}
