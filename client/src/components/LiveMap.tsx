import { MapView, type MapViewProps } from "@shared/map/MapView";
import { MAPBOX_TOKEN } from "@/config";
import { useTheme } from "@/lib/theme";
import { useT } from "@/lib/i18n/provider";

/** Mapbox has Russian and English labels; Uzbek keeps the local names. */
const LABEL_LANGUAGE: Record<string, string | undefined> = { ru: "ru", en: "en" };

/**
 * The interactive map (Mapbox) with this app's token, theme and language.
 * Pass the drawn map as `fallback`: it is what shows without
 * VITE_MAPBOX_TOKEN, without WebGL, while loading and when loading fails.
 */
export function LiveMap(props: Omit<MapViewProps, "token" | "theme" | "language">) {
  const { theme } = useTheme();
  const { locale } = useT();
  return <MapView {...props} token={MAPBOX_TOKEN} theme={theme} language={LABEL_LANGUAGE[locale]} />;
}

/** Whether this build has the interactive map at all. */
export const LIVE_MAP = MAPBOX_TOKEN !== "";
