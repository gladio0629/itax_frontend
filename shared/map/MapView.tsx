import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import { provider } from "@map-provider";
import { TASHKENT, boundsOf, distanceM, isLatLng, pointsKey, toLngLat, type LatLng } from "./geo.ts";
import { PIN_Z, Pin, type PinKind } from "./pins.tsx";
import type { MapRuntime, MapboxGeoJSONSource as GeoJSONSource, MapboxMap, MapboxMarker } from "./provider.types.ts";

// The interactive map of the client and driver apps (Mapbox GL JS).
//
// It draws only what it is given — markers, route lines, a camera target —
// and knows nothing about orders or drivers. Without a Mapbox token in the
// build, without WebGL, or when the map fails to load, it renders `fallback`
// (each app passes its drawn map), so a screen works either way.

export type MapMarker = {
  id: string;
  position: LatLng;
  /** Built-in look. Ignored when `content` is given. */
  kind?: PinKind;
  /** Custom marker body (the app's own pin, a bubble…), rendered in place. */
  content?: ReactNode;
  /** Which part of the marker sits on the coordinate. Default: its centre. */
  anchor?: "center" | "bottom" | "top";
  /** Glide to a new position instead of jumping (a moving car). */
  animate?: boolean;
};

export type MapRoute = {
  id: string;
  path: readonly LatLng[];
  /** Default: the app's --map-route colour. */
  color?: string;
  width?: number;
  dashed?: boolean;
  opacity?: number;
};

export type MapPadding = { top?: number; right?: number; bottom?: number; left?: number };

export type MapViewProps = {
  /** Mapbox public token (VITE_MAPBOX_TOKEN). Empty: `fallback` is shown. */
  token: string;
  theme?: "light" | "dark";
  /** Where the camera looks when `fit` has no points. Default: Tashkent. */
  center?: LatLng | null;
  /** Zoom for a single point. */
  zoom?: number;
  markers?: readonly MapMarker[];
  routes?: readonly MapRoute[];
  /** Points to keep in view. */
  fit?: readonly (LatLng | null | undefined)[];
  /** When given, the camera moves only when this text changes (pass it when
   * a fitted point moves all the time, e.g. a car). Without it the camera
   * follows the fitted points. */
  fitKey?: string;
  /** Closest zoom when fitting. */
  maxZoom?: number;
  /** Part of the map covered by other UI (a bottom sheet, a header): the
   * camera and Mapbox's own logo/attribution stay clear of it. */
  padding?: MapPadding;
  /** false: a picture — no panning or zooming. */
  interactive?: boolean;
  /** One finger scrolls the page, two move the map (a map inside a list). */
  cooperativeGestures?: boolean;
  /** Label language ("ru", "en"); default: the local names. */
  language?: string;
  /** Corner for Mapbox's logo and attribution (they must stay visible):
   * pick one the screen's own buttons leave free. Default: bottom-left. */
  creditsCorner?: "bottom-left" | "bottom-right" | "top-left" | "top-right";
  /** Must position the map: e.g. "absolute inset-0" or "relative h-48". */
  className?: string;
  ariaLabel?: string;
  /** Shown while the map loads and whenever it can't be shown. */
  fallback?: ReactNode;
};

const STYLES = { light: "mapbox://styles/mapbox/streets-v12", dark: "mapbox://styles/mapbox/dark-v11" } as const;
const DEFAULT_ZOOM = 13;
const DEFAULT_MAX_ZOOM = 15;
/** Kept between fitted points and the edge of the visible map. */
const FIT_MARGIN = 56;
/** The camera keeps at least this much of the map uncovered by padding. */
const MIN_VISIBLE = 96;
/** No "load" event within this time (offline, blocked): show the fallback. */
const LOAD_TIMEOUT_MS = 15_000;
/** A marker further than this from its last position jumps (no slide across town). */
const GLIDE_MAX_M = 3000;
const GLIDE_MS = 900;
const SOURCE = (id: string) => `izgo-route-${id}`;
const CASING = (id: string) => `izgo-route-${id}-casing`;
const LINE = (id: string) => `izgo-route-${id}-line`;

type LiveMarker = { marker: MapboxMarker; el: HTMLElement; anchor: string; frame: number };
type Status = "loading" | "ready" | "failed";

const reducedMotion = () => typeof window !== "undefined" && !!window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;

function cssVar(el: HTMLElement, name: string, fallback: string): string {
  const v = getComputedStyle(el).getPropertyValue(name).trim();
  return v || fallback;
}

function paddingOf(el: HTMLElement, p: MapPadding | undefined, margin: number) {
  const out = { top: (p?.top ?? 0) + margin, right: (p?.right ?? 0) + margin, bottom: (p?.bottom ?? 0) + margin, left: (p?.left ?? 0) + margin };
  // Padding larger than the map leaves Mapbox nothing to fit into.
  const fitAxis = (a: "top" | "left", b: "bottom" | "right", size: number) => {
    const room = Math.max(0, size - MIN_VISIBLE);
    const sum = out[a] + out[b];
    if (sum > room && sum > 0) {
      out[a] = (out[a] / sum) * room;
      out[b] = (out[b] / sum) * room;
    }
  };
  fitAxis("top", "bottom", el.clientHeight);
  fitAxis("left", "right", el.clientWidth);
  return out;
}

export function MapView(props: MapViewProps) {
  const { token, theme = "light", className, ariaLabel, fallback, markers = [], routes = [] } = props;
  const enabled = !!provider.load && !!token;
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapboxMap | null>(null);
  const runtimeRef = useRef<MapRuntime | null>(null);
  const liveMarkers = useRef(new Map<string, LiveMarker>());
  const drawnRoutes = useRef(new Map<string, string>());
  const cameraMoved = useRef(false);
  // The latest props, for callbacks that outlive a render (map events).
  const latest = useRef(props);
  latest.current = props;
  const [status, setStatus] = useState<Status>(enabled ? "loading" : "failed");
  const [markerEls, setMarkerEls] = useState<Record<string, HTMLElement>>({});

  // ------------------------------------------------------------ routes
  function syncRoutes() {
    const map = mapRef.current;
    const el = containerRef.current;
    if (!map || !el) return;
    const dark = (latest.current.theme ?? "light") === "dark";
    const wanted = new Map((latest.current.routes ?? []).filter((r) => r.path.length >= 2).map((r) => [r.id, r]));
    try {
      for (const id of [...drawnRoutes.current.keys()]) {
        if (wanted.has(id)) continue;
        if (map.getLayer(LINE(id))) map.removeLayer(LINE(id));
        if (map.getLayer(CASING(id))) map.removeLayer(CASING(id));
        if (map.getSource(SOURCE(id))) map.removeSource(SOURCE(id));
        drawnRoutes.current.delete(id);
      }
      // Above every road, under the labels: the style ends with a block of
      // label (symbol) layers, and the line goes right below that block.
      // (Symbol layers also sit between the road layers — one-way arrows —
      // so "the first symbol layer" would put the line under the roads.)
      const layers = map.getStyle()?.layers ?? [];
      let labels = layers.length;
      while (labels > 0 && layers[labels - 1].type === "symbol") labels -= 1;
      const before = layers[labels]?.id;
      for (const [id, r] of wanted) {
        const data = { type: "Feature" as const, properties: {}, geometry: { type: "LineString" as const, coordinates: r.path.map(toLngLat) } };
        const color = r.color ?? cssVar(el, "--map-route", "#2f6bff");
        const casing = cssVar(el, "--map-route-casing", dark ? "#0b1020" : "#ffffff");
        const width = r.width ?? 5;
        const look = [color, casing, width, r.dashed ? 1 : 0, r.opacity ?? 1].join("|");
        const source = map.getSource(SOURCE(id)) as GeoJSONSource | undefined;
        if (source && drawnRoutes.current.get(id) === look && map.getLayer(LINE(id))) {
          source.setData(data);
          continue;
        }
        if (map.getLayer(LINE(id))) map.removeLayer(LINE(id));
        if (map.getLayer(CASING(id))) map.removeLayer(CASING(id));
        if (source) source.setData(data);
        else map.addSource(SOURCE(id), { type: "geojson", data });
        const layout = { "line-cap": "round" as const, "line-join": "round" as const };
        map.addLayer({ id: CASING(id), type: "line", source: SOURCE(id), layout, paint: { "line-color": casing, "line-width": width + 4, "line-opacity": (r.opacity ?? 1) * 0.9 } }, before);
        map.addLayer(
          {
            id: LINE(id),
            type: "line",
            source: SOURCE(id),
            layout,
            paint: { "line-color": color, "line-width": width, "line-opacity": r.opacity ?? 1, ...(r.dashed ? { "line-dasharray": [0.6, 1.8] } : {}) },
          },
          before
        );
        drawnRoutes.current.set(id, look);
      }
    } catch {
      // The style is being swapped (theme change): "style.load" runs this again.
    }
  }

  // ----------------------------------------------------------- markers
  function syncMarkers() {
    const map = mapRef.current;
    const gl = runtimeRef.current?.mapboxgl;
    if (!map || !gl) return;
    const wanted = (latest.current.markers ?? []).filter((m) => isLatLng(m.position));
    const ids = new Set(wanted.map((m) => m.id));
    let changed = false;
    for (const [id, live] of liveMarkers.current) {
      if (ids.has(id)) continue;
      cancelAnimationFrame(live.frame);
      live.marker.remove();
      liveMarkers.current.delete(id);
      changed = true;
    }
    for (const m of wanted) {
      const anchor = m.anchor ?? "center";
      let live = liveMarkers.current.get(m.id);
      if (live && live.anchor !== anchor) {
        cancelAnimationFrame(live.frame);
        live.marker.remove();
        liveMarkers.current.delete(m.id);
        live = undefined;
      }
      if (!live) {
        const el = document.createElement("div");
        el.style.zIndex = String(PIN_Z[m.kind ?? "pickup"]);
        const marker = new gl.Marker({ element: el, anchor }).setLngLat(toLngLat(m.position)).addTo(map);
        liveMarkers.current.set(m.id, { marker, el, anchor, frame: 0 });
        changed = true;
        continue;
      }
      const from = live.marker.getLngLat();
      const start = { lat: from.lat, lng: from.lng };
      cancelAnimationFrame(live.frame);
      const far = distanceM(start, m.position);
      if (!m.animate || reducedMotion() || far < 0.5 || far > GLIDE_MAX_M) {
        live.marker.setLngLat(toLngLat(m.position));
        continue;
      }
      const target = m.position;
      const t0 = performance.now();
      const moving = live;
      const step = (now: number) => {
        const t = Math.min(1, (now - t0) / GLIDE_MS);
        moving.marker.setLngLat([start.lng + (target.lng - start.lng) * t, start.lat + (target.lat - start.lat) * t]);
        if (t < 1) moving.frame = requestAnimationFrame(step);
      };
      live.frame = requestAnimationFrame(step);
    }
    if (changed) setMarkerEls(Object.fromEntries([...liveMarkers.current].map(([id, l]) => [id, l.el])));
  }

  // ------------------------------------------------------------ camera
  function moveCamera() {
    const map = mapRef.current;
    const el = containerRef.current;
    if (!map || !el) return;
    const p = latest.current;
    const points = (p.fit ?? []).filter((x): x is LatLng => !!x && isLatLng(x));
    const duration = cameraMoved.current && !reducedMotion() ? 600 : 0;
    cameraMoved.current = true;
    const distinct = points.length > 1 && points.some((x) => distanceM(x, points[0]) > 5);
    if (distinct) {
      const bounds = boundsOf(points);
      if (bounds) {
        map.fitBounds(bounds, { padding: paddingOf(el, p.padding, FIT_MARGIN), maxZoom: p.maxZoom ?? DEFAULT_MAX_ZOOM, duration });
        return;
      }
    }
    const target = points[0] ?? (p.center && isLatLng(p.center) ? p.center : TASHKENT);
    map.easeTo({ center: toLngLat(target), zoom: p.zoom ?? DEFAULT_ZOOM, padding: paddingOf(el, p.padding, 0), duration });
  }

  /** Mapbox's logo and attribution must stay visible: keep them clear of
   * the sheet below and the header above. */
  function placeControls() {
    const el = containerRef.current;
    if (!el) return;
    const pad = latest.current.padding;
    for (const c of el.querySelectorAll<HTMLElement>(".mapboxgl-ctrl-bottom-left, .mapboxgl-ctrl-bottom-right")) c.style.bottom = `${pad?.bottom ?? 0}px`;
    for (const c of el.querySelectorAll<HTMLElement>(".mapboxgl-ctrl-top-left, .mapboxgl-ctrl-top-right")) c.style.top = `${pad?.top ?? 0}px`;
    // Logo and attribution side by side (Mapbox stacks them): one short row
    // fits where a column wouldn't.
    for (const c of el.querySelectorAll<HTMLElement>(".mapboxgl-ctrl")) c.style.clear = "none";
  }

  // -------------------------------------------------------------- init
  useEffect(() => {
    if (!enabled || !provider.load) {
      setStatus("failed");
      return;
    }
    let disposed = false;
    let map: MapboxMap | null = null;
    let observer: ResizeObserver | null = null;
    let loadTimer: ReturnType<typeof setTimeout> | undefined;
    setStatus("loading");

    const destroy = () => {
      clearTimeout(loadTimer);
      observer?.disconnect();
      observer = null;
      for (const live of liveMarkers.current.values()) {
        cancelAnimationFrame(live.frame);
        live.marker.remove();
      }
      liveMarkers.current.clear();
      drawnRoutes.current.clear();
      cameraMoved.current = false;
      mapRef.current = null;
      runtimeRef.current = null;
      const m = map;
      map = null;
      try {
        m?.remove();
      } catch {
        /* a half-created map */
      }
    };
    const fail = () => {
      if (disposed) return;
      destroy();
      setMarkerEls({});
      setStatus("failed");
    };

    provider
      .load()
      .then((runtime) => {
        const el = containerRef.current;
        if (disposed || !el) return;
        const gl = runtime.mapboxgl;
        const p = latest.current;
        const first = (p.fit ?? []).find((x): x is LatLng => !!x && isLatLng(x)) ?? (p.center && isLatLng(p.center) ? p.center : TASHKENT);
        const interactive = p.interactive ?? true;
        const createdWith = STYLES[p.theme ?? "light"];
        // Throws without WebGL: caught below, the fallback is shown.
        const created = new gl.Map({
          container: el,
          accessToken: token,
          style: createdWith,
          center: toLngLat(first),
          zoom: p.zoom ?? DEFAULT_ZOOM,
          interactive,
          cooperativeGestures: interactive && !!p.cooperativeGestures,
          // A flat, north-up map: rotation and tilt only disorient here.
          projection: "mercator",
          dragRotate: false,
          pitchWithRotate: false,
          touchPitch: false,
          attributionControl: false,
          logoPosition: p.creditsCorner ?? "bottom-left",
          ...(p.language ? { language: p.language } : {}),
        });
        map = created;
        created.addControl(new gl.AttributionControl({ compact: true }), p.creditsCorner ?? "bottom-left");
        if (interactive) created.touchZoomRotate.disableRotation();
        mapRef.current = created;
        runtimeRef.current = runtime;
        let loaded = false;
        created.on("load", () => {
          if (disposed) return;
          loaded = true;
          clearTimeout(loadTimer);
          placeControls();
          syncRoutes();
          syncMarkers();
          moveCamera();
          setStatus("ready");
          // The theme changed while the map was loading.
          if (STYLES[latest.current.theme ?? "light"] !== createdWith) created.setStyle(STYLES[latest.current.theme ?? "light"]);
        });
        // After a theme change the new style starts empty.
        created.on("style.load", () => {
          drawnRoutes.current.clear();
          if (loaded) syncRoutes();
        });
        // A refused token never loads: fall back at once. Other errors
        // (one tile, a flaky connection) are left to the load timeout.
        created.on("error", (e) => {
          const code = (e?.error as { status?: number } | undefined)?.status;
          if (!loaded && (code === 401 || code === 403)) fail();
        });
        loadTimer = setTimeout(() => {
          if (!loaded) fail();
        }, LOAD_TIMEOUT_MS);
        observer = new ResizeObserver(() => map?.resize());
        observer.observe(el);
      })
      .catch(fail); // the chunk didn't load, or WebGL is unavailable

    return () => {
      disposed = true;
      destroy();
      setMarkerEls({});
    };
    // Map options that can't change on a live map recreate it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enabled, token, props.interactive, props.cooperativeGestures, props.language, props.creditsCorner]);

  const ready = status === "ready";

  // --------------------------------------------------- props → the map
  useEffect(() => {
    const map = mapRef.current;
    if (!ready || !map) return;
    // "style.load" redraws the routes on the new style.
    map.setStyle(STYLES[theme]);
    // Skipped on the first run: the map was created with this style.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);

  const routesKey = routes.map((r) => [r.id, r.color ?? "", r.width ?? "", r.dashed ? 1 : 0, r.opacity ?? "", r.path.length, pointsKey([r.path[0], r.path[r.path.length - 1]])].join(",")).join("|");
  useEffect(() => {
    if (ready) syncRoutes();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, routesKey]);

  const markersKey = markers.map((m) => `${m.id}:${m.anchor ?? ""}:${pointsKey([m.position])}`).join("|");
  useEffect(() => {
    if (ready) syncMarkers();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, markersKey]);

  const pad = props.padding;
  const paddingKey = `${pad?.top ?? 0},${pad?.right ?? 0},${pad?.bottom ?? 0},${pad?.left ?? 0}`;
  const cameraKey = props.fitKey ?? `${pointsKey(props.fit ?? [])}|${pointsKey([props.center])}|${props.zoom ?? ""}`;
  useEffect(() => {
    if (!ready) return;
    placeControls();
    moveCamera();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cameraKey, paddingKey]);

  return (
    <div className={className} data-map={status}>
      {enabled && (
        <div
          ref={containerRef}
          role="region"
          aria-label={ariaLabel}
          // isolate: markers have z-indexes of their own, which must order
          // them inside the map only — never above the app's UI over it.
          style={{ position: "absolute", inset: 0, isolation: "isolate", visibility: ready ? "visible" : "hidden" }}
        />
      )}
      {!ready && fallback}
      {ready && markers.map((m) => (markerEls[m.id] ? createPortal(m.content ?? <Pin kind={m.kind ?? "pickup"} />, markerEls[m.id], m.id) : null))}
    </div>
  );
}
