import { api } from "@/api/client";
import type { Booking, Place } from "@/api/types";
import { LiveMap, LIVE_MAP } from "@/components/LiveMap";
import { MAPBOX_TOKEN } from "@/config";
import { isLatLng, type LatLng } from "@shared/map/geo";
import type { MapMarker, MapPadding, MapRoute } from "@shared/map/MapView";
import { useCoarsePoint, useGeolocation } from "@shared/map/useGeolocation";
import { useRoute } from "@shared/map/useRoute";
import { DriverMap } from "@/features/home/DriverMap";

/** The route to the pickup is re-asked only after the car has moved this far. */
const REROUTE_AFTER_M = 200;

function pointOf(place: Place | undefined): LatLng | null {
  const p = { lat: place?.lat, lng: place?.lng };
  return isLatLng(p) ? p : null;
}

/**
 * The trip screens' full-screen map (always light): the driver, the pickup,
 * the stops and the destination; the road to the passenger while heading
 * there, the trip's road after. The drawn map is the fallback.
 */
export function TripMap({ booking, label, padding }: { booking: Booking; label: string; padding?: MapPadding }) {
  const me = useGeolocation({ enabled: LIVE_MAP, simulated: api.simulatedPosition() });
  const pickup = pointOf(booking.pickup);
  const dropoff = pointOf(booking.dropoff);
  const stops = booking.stops.map(pointOf).filter((p): p is LatLng => !!p);
  const toPickup = booking.stage === "to_pickup";

  const origin = useCoarsePoint(toPickup ? me : null, REROUTE_AFTER_M);
  const approach = useRoute(MAPBOX_TOKEN, [origin, toPickup ? pickup : null]);
  const trip = useRoute(MAPBOX_TOKEN, [pickup, ...stops, dropoff]);

  const routes: MapRoute[] = [];
  if (trip && !toPickup) routes.push({ id: "trip", path: trip.path });
  if (toPickup && approach) routes.push({ id: "approach", path: approach.path });

  const markers: MapMarker[] = [];
  if (pickup && booking.stage !== "in_progress") markers.push({ id: "pickup", position: pickup, kind: "pickup" });
  stops.forEach((p, i) => markers.push({ id: `stop-${i}`, position: p, kind: "dropoff" }));
  if (dropoff && !toPickup) markers.push({ id: "dropoff", position: dropoff, kind: "dropoff" });
  if (me) {
    markers.push({
      id: "me",
      position: me,
      kind: "driver",
      animate: true,
      content: (
        <span className="relative block h-9 w-9 rounded-full bg-brand/30">
          <span className="absolute inset-[5px] rounded-full border-[3px] border-night bg-brand" />
        </span>
      ),
    });
  }
  const fit = toPickup ? [me, pickup] : booking.stage === "waiting" ? [me ?? pickup, pickup] : [me ?? pickup, ...stops, dropoff];
  return (
    <LiveMap
      className="absolute inset-0"
      ariaLabel={label}
      center={me ?? pickup}
      zoom={14}
      markers={markers}
      routes={routes}
      fit={fit}
      fitKey={`${booking.id}:${booking.stage}:${me ? 1 : 0}`}
      padding={padding}
      fallback={
        <div className="absolute inset-x-0 top-0" style={{ bottom: padding?.bottom ?? 0 }}>
          <DriverMap label={label} />
        </div>
      }
    />
  );
}
