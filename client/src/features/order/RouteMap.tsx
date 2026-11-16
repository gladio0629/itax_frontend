import type { ReactNode } from "react";
import { MapCanvas, ROUTE } from "@/components/MapCanvas";
import { LiveMap } from "@/components/LiveMap";
import { MAPBOX_TOKEN } from "@/config";
import { useT } from "@/lib/i18n/provider";
import type { Address } from "@/api/types";
import { useRoute } from "@shared/map/useRoute";
import type { MapMarker } from "@shared/map/MapView";
import { addressPoint } from "./mapPoints";

/**
 * The map of the order sheet: pickup, drop-off (and stops) with the road
 * route between them, and the two bubbles the sheet shows on its ends.
 * Fills its parent, which must be a size container (`[container-type:size]`)
 * for the drawn fallback map.
 */
export function RouteMap({
  from,
  to,
  stops = [],
  fromBubble,
  toBubble,
}: {
  from: Address | null;
  to: Address | null;
  stops?: (Address | undefined)[];
  /** Shown above the pickup (minutes until a car arrives). */
  fromBubble?: ReactNode;
  /** Shown above the drop-off (arrival time). */
  toBubble?: ReactNode;
}) {
  const { t } = useT();
  const a = addressPoint(from);
  const b = addressPoint(to);
  const via = stops.map(addressPoint).filter((p) => p !== null);
  const route = useRoute(MAPBOX_TOKEN, [a, ...via, b]);

  const markers: MapMarker[] = [];
  if (a) {
    markers.push({
      id: "from",
      position: a,
      anchor: "bottom",
      content: (
        <span className="flex flex-col items-center">
          {fromBubble}
          {/* The ring's centre sits on the point. */}
          <span className="mt-2 -mb-[9px] h-[18px] w-[18px] rounded-full border-[5px] border-ink bg-card shadow-[0_2px_8px_rgba(0,0,0,0.25)]" aria-hidden="true" />
        </span>
      ),
    });
  }
  via.forEach((p, i) => markers.push({ id: `stop-${i}`, position: p, kind: "stop" }));
  if (b) {
    markers.push({
      id: "to",
      position: b,
      anchor: "bottom",
      content: (
        <span className="flex flex-col items-center">
          {toBubble}
          <span className="mt-2 -mb-[9px] h-[18px] w-[18px] rounded-[5px] border-[3px] border-on-yellow bg-brand-yellow shadow-[0_2px_8px_rgba(0,0,0,0.25)]" aria-hidden="true" />
        </span>
      ),
    });
  }

  // MapCanvas is "slice"-fitted: a 0–100 point lands at 50% + (p−50) of the
  // larger side (container query units).
  const point = (x: number, y: number) => ({
    left: `calc(50% + (${x} - 50) * max(1cqw, 1cqh))`,
    top: `calc(50% + (${y} - 50) * max(1cqw, 1cqh))`,
  });

  return (
    <LiveMap
      className="absolute inset-0"
      ariaLabel={t("map.routeLabel")}
      markers={markers}
      routes={route ? [{ id: "route", path: route.path }] : []}
      fit={[a, ...via, b]}
      // Room for the bubbles above the pins and the sheet's rounded top below.
      padding={{ top: 64, bottom: 48 }}
      // Bottom-left is the back button's corner.
      creditsCorner="bottom-right"
      fallback={
        <>
          <MapCanvas route className="absolute inset-0" />
          {toBubble && (
            <span className="absolute -translate-x-1/2 -translate-y-[calc(100%+10px)]" style={point(ROUTE.to[0], ROUTE.to[1])}>
              {toBubble}
            </span>
          )}
          {fromBubble && (
            <span className="absolute -translate-x-1/2 -translate-y-[calc(100%+8px)]" style={point(ROUTE.from[0], ROUTE.from[1])}>
              {fromBubble}
            </span>
          )}
        </>
      }
    />
  );
}
