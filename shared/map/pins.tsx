import type { CSSProperties } from "react";

// Built-in marker looks for <MapView />. Inline styles only: this file is
// used by apps with different design tokens and Tailwind setups. Colours
// come from the app's CSS variables where one exists, with a neutral default.
export type PinKind = "pickup" | "dropoff" | "driver" | "user" | "stop";

const SHADOW = "0 2px 8px rgba(0, 0, 0, 0.28)";
const DARK = "var(--map-pin-dark, #101828)";
const LIGHT = "var(--map-pin-light, #ffffff)";
const YELLOW = "var(--map-pin-accent, #ffd400)";
const BLUE = "var(--map-pin-user, #2f6bff)";

const center: CSSProperties = { display: "flex", alignItems: "center", justifyContent: "center" };

export function Pin({ kind }: { kind: PinKind }) {
  switch (kind) {
    case "user":
      return (
        <span style={{ ...center, width: 28, height: 28, borderRadius: "50%", background: "rgba(47, 107, 255, 0.2)" }}>
          <span style={{ width: 14, height: 14, borderRadius: "50%", background: BLUE, border: `3px solid ${LIGHT}`, boxShadow: SHADOW, boxSizing: "content-box" }} />
        </span>
      );
    case "driver":
      return (
        <span style={{ ...center, width: 34, height: 34, borderRadius: "50%", background: DARK, border: `2px solid ${LIGHT}`, boxShadow: SHADOW, color: LIGHT }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M19 17h2c.6 0 1-.4 1-1v-3c0-.9-.7-1.700-1.500-1.900C18.700 10.600 16 10 16 10s-1.300-1.400-2.200-2.300c-.5-.4-1.100-.7-1.800-.7H5c-.6 0-1.100.4-1.400.9l-1.400 2.900A3.700 3.700 0 0 0 2 12v4c0 .6.4 1 1 1h2" />
            <circle cx="7" cy="17" r="2" />
            <path d="M9 17h6" />
            <circle cx="17" cy="17" r="2" />
          </svg>
        </span>
      );
    case "dropoff":
      return <span style={{ display: "block", width: 18, height: 18, borderRadius: 5, background: YELLOW, border: `3px solid ${DARK}`, boxShadow: SHADOW }} />;
    case "stop":
      return <span style={{ display: "block", width: 12, height: 12, borderRadius: "50%", background: DARK, border: `2px solid ${LIGHT}`, boxShadow: SHADOW }} />;
    case "pickup":
    default:
      return <span style={{ display: "block", width: 18, height: 18, borderRadius: "50%", background: LIGHT, border: `5px solid ${DARK}`, boxShadow: SHADOW }} />;
  }
}

/** Markers that move (the car, "you are here") stay above route ends. */
export const PIN_Z: Record<PinKind, number> = { stop: 1, pickup: 2, dropoff: 2, user: 3, driver: 4 };
