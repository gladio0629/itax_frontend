import { useState } from "react";
import { api } from "@/api/client";
import type { AcceptedPage, Booking, Place } from "@/api/types";
import { LiveMap, LIVE_MAP } from "@/components/LiveMap";
import { MAPBOX_TOKEN } from "@/config";
import { useT } from "@/lib/i18n/provider";
import { LocateFixed } from "@/lib/icons";
import { isLatLng, type LatLng } from "@shared/map/geo";
import type { MapMarker, MapRoute } from "@shared/map/MapView";
import { useCoarsePoint, useGeolocation } from "@shared/map/useGeolocation";
import { useRoute } from "@shared/map/useRoute";
import { DriverMap } from "./DriverMap";

/** The route to the pickup is re-asked only after the car has moved this far. */
const REROUTE_AFTER_M = 200;
const STAGE_RANK = { in_progress: 0, waiting: 1, to_pickup: 2, completed: 3 } as const;

/** The accepted booking the map is about: the server's active one, else the one under way, else the nearest pickup. */
function bookingInFocus(page: AcceptedPage | undefined): Booking | null {
  const all = (page?.days ?? []).flatMap((d) => d.trips.flatMap((trip) => trip.bookings.map((b) => ({ b, day: d.dayOffset }))));
  const open = all.filter((x) => x.b.stage !== "completed");
  const active = open.find((x) => x.b.id === page?.activeBookingId);
  if (active) return active.b;
  open.sort((x, y) => STAGE_RANK[x.b.stage] - STAGE_RANK[y.b.stage] || x.day - y.day || x.b.acceptedAt - y.b.acceptedAt);
  return open[0]?.b ?? null;
}

function pointOf(place: Place | undefined): LatLng | null {
  const p = { lat: place?.lat, lng: place?.lng };
  return isLatLng(p) ? p : null;
}

/**
 * Home's map card (always light): where the driver is and, once a request
 * is accepted, the road to the passenger and on to the destination. One
 * finger scrolls the page, two move the map. The drawn map is the fallback
 * (no Mapbox token in the build, no WebGL, offline).
 */
export function HomeMap({ accepted }: { accepted: AcceptedPage | undefined }) {
  const { t } = useT();
  const [refit, setRefit] = useState(0);
  // GPS on the real backend; the sample data's mock coordinates otherwise.
  const me = useGeolocation({ enabled: LIVE_MAP, simulated: api.simulatedPosition() });
  const booking = bookingInFocus(accepted);
  const pickup = pointOf(booking?.pickup);
  const dropoff = pointOf(booking?.dropoff);
  const toPickup = booking?.stage === "to_pickup";

  const origin = useCoarsePoint(toPickup ? me : null, REROUTE_AFTER_M);
  const approach = useRoute(MAPBOX_TOKEN, [origin, toPickup ? pickup : null]);
  const trip = useRoute(MAPBOX_TOKEN, [pickup, dropoff]);

  const routes: MapRoute[] = [];
  // While heading to the pickup the trip itself stays in the background.
  if (trip) routes.push({ id: "trip", path: trip.path, ...(toPickup ? { opacity: 0.45, width: 4 } : {}) });
  if (toPickup && approach) routes.push({ id: "approach", path: approach.path });

  const markers: MapMarker[] = [];
  if (pickup && booking?.stage !== "in_progress") markers.push({ id: "pickup", position: pickup, kind: "pickup" });
  if (dropoff) markers.push({ id: "dropoff", position: dropoff, kind: "dropoff" });
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

  const label = booking ? t("home.mapRouteLabel") : t("home.mapLabel");
  const fit = !booking ? [me] : toPickup ? [me, pickup] : booking.stage === "waiting" ? [pickup, dropoff] : [me ?? pickup, dropoff];
  return (
    <section aria-label={label} className="relative h-[168px] shrink-0 overflow-hidden rounded-card bg-raised">
      <LiveMap
        className="absolute inset-0"
        ariaLabel={label}
        center={me}
        zoom={14}
        markers={markers}
        routes={routes}
        fit={fit}
        // Not on every GPS fix: when the trip or its stage changes, when the
        // first position arrives, or on "recentre".
        fitKey={`${booking?.id ?? "idle"}:${booking?.stage ?? ""}:${me ? 1 : 0}${pickup ? 1 : 0}${dropoff ? 1 : 0}:${refit}`}
        cooperativeGestures
        creditsCorner="bottom-left"
        fallback={<DriverMap label={label} />}
      />
      {LIVE_MAP && (
        <button
          type="button"
          onClick={() => setRefit((n) => n + 1)}
          aria-label={t("home.mapRecenter")}
          className="press absolute right-2.5 top-2.5 flex h-11 w-11 items-center justify-center rounded-full bg-surface text-ink shadow-2"
        >
          <LocateFixed className="h-5 w-5" />
        </button>
      )}
    </section>
  );
}
