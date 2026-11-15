import { useEffect } from "react";
import { api } from "@/api/client";

const INTERVAL_MS = 10_000;

/**
 * Sends the driver's GPS fix to the backend while `active` (the request feed
 * is open or a trip is in progress), at most once every 10 s. The server
 * forgets a position after ~2 minutes, so the last fix is re-sent on that
 * cadence even when the car isn't moving. Stops as soon as `active` turns
 * false or the screen unmounts (logout). Errors are silent: a missed fix is
 * replaced by the next one, and coordinates are never logged.
 */
export function useLocationReporting(active: boolean) {
  useEffect(() => {
    if (!active || !api.capabilities.locationReporting || typeof navigator === "undefined" || !navigator.geolocation) return;
    let last: { lat: number; lng: number } | null = null;
    let lastSentAt = 0;

    const send = () => {
      if (!last || Date.now() - lastSentAt < INTERVAL_MS) return;
      lastSentAt = Date.now();
      api.reportLocation(last.lat, last.lng).catch(() => {});
    };

    const watchId = navigator.geolocation.watchPosition(
      (pos) => {
        last = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        send();
      },
      () => {
        /* permission denied / unavailable: nothing to send */
      },
      { enableHighAccuracy: true, maximumAge: 5_000, timeout: 20_000 }
    );
    const timer = setInterval(send, INTERVAL_MS);
    return () => {
      navigator.geolocation.clearWatch(watchId);
      clearInterval(timer);
    };
  }, [active]);
}
