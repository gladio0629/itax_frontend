// check:no-network for all three apps; each app's scripts/check-no-network.mjs
// calls checkNoNetwork(). Mode comes from the same env Vite uses for a
// production build (shell/host env > .env.production > .env):
//   VITE_DEMO_MODE=true  → no network code at all (mock adapter only).
//   otherwise (http)     → network code only in the shared transport files,
//                          and the only origin it may reach is VITE_API_URL.
//
// 1. Source scan (src/, index.html, ../shared/http, ../shared/api,
//    ../shared/map): no third-party hosts, and fetch / WebSocket / XHR only
//    in the transport allowlist below.
// 2. Build scan (dist/, when present): in demo mode the bundle has no
//    fetch/WebSocket; every absolute URL is either the API origin (http
//    mode) or a known non-network string (XML namespaces, React's error
//    docs); index.html and _headers allow connect-src 'self' + the API
//    origin only, and match the current env (else: rebuild).
//    One more host may appear as a plain link: https://xasanow.uz, bare or
//    with /terms, /privacy or /delete-account (LEGAL_LINK_ORIGIN below). In
//    sources it may appear only as the bare origin in src/config.ts (the
//    SITE_URL default).
//
// The interactive map (client and driver, `mapbox: true`) is the one
// exception, and only when the build has VITE_MAPBOX_TOKEN:
//   - sources: mapbox-gl and the Mapbox host may appear only in the map
//     transport files of ../shared/map (always checked, token or not);
//   - build: Mapbox code and hosts may appear only in the lazily loaded
//     mapboxRuntime chunk, and connect-src gains exactly the Mapbox hosts.
// Without the token nothing changes: no Mapbox code may be in the build.
import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative, resolve, sep } from "node:path";

const NETWORK_CALLS = [
  // The global fetch (bare or via window/globalThis/self), not a method that
  // happens to be called fetch (react-router's `router.fetch(`).
  [/(?:^|[^.\w$]|\b(?:window|globalThis|self)\.)fetch\s*\(/m, "fetch("],
  [/XMLHttpRequest/, "XMLHttpRequest"],
  [/\bnew\s+WebSocket\s*\(/, "WebSocket("],
  [/EventSource\s*\(/, "EventSource("],
  [/navigator\.sendBeacon/, "sendBeacon"],
];
const THIRD_PARTY = [
  [/\baxios\b/, "axios"],
  [/googleapis\.com/, "googleapis.com"],
  [/maps\.google/, "maps.google"],
  [/fonts\.gstatic/, "fonts.gstatic"],
  [/cdn\.jsdelivr/, "cdn.jsdelivr"],
  [/unpkg\.com/, "unpkg.com"],
  [/sentry\.io/, "sentry.io"],
  [/google-analytics/, "google-analytics"],
];
// example.com is reserved (RFC 2606) and only appears in hints.
const EXTERNAL_URL = /\bhttps?:\/\/(?!localhost\b|127\.0\.0\.1\b|(?:[a-z0-9-]+\.)*example\.com\b)[a-z0-9.-]+/gi;
// The map library: importing it pulls network code into the bundle.
const MAPBOX_IMPORT = /["']mapbox-gl(?:\/[^"']*\.js)?["']/;
// connect-src additions for the map; the same list as MAPBOX_CONNECT_SRC in
// shared/vite/izgo.ts.
const MAPBOX_CONNECT_SRC = ["https://api.mapbox.com", "https://events.mapbox.com", "https://*.tiles.mapbox.com"];
const isMapboxHost = (host) => host === "mapbox.com" || host.endsWith(".mapbox.com");
// Named inside the mapbox-gl bundle but never requested: its telemetry host
// for the China region, used only with a mapbox.cn API URL — and connect-src
// does not allow it.
const MAPBOX_CHUNK_INERT_HOSTS = ["events.mapbox.cn"];
// The chunk Vite emits for ../shared/map/mapboxRuntime.ts (mapbox-gl + Directions).
const MAPBOX_CHUNK = /(?:^|\/)(?:mapboxRuntime|mapbox-gl)-[\w-]+\.js$/;
// Absolute URLs that occur in third-party bundles as plain text (XML
// namespaces, React/router error links). They are never requested.
const INERT_HOSTS = ["www.w3.org", "reactjs.org", "react.dev", "fb.me", "github.com", "localhost", "127.0.0.1", "example.com"];
// The public site, as a plain link opened in the system browser (owner
// decisions 2026-11-22: terms, privacy and account deletion only). Sources:
// only the bare origin, only in the app's src/config.ts (SITE_URL default,
// VITE_SITE_URL overrides it). Exact origin: no subdomain (api.xasanow.uz is
// the API and needs VITE_API_URL), no http, no ws. Never added to
// connect-src (the CSP check below stays exact).
const LEGAL_LINK_ORIGIN = "https://xasanow.uz";
// What may follow the origin in the bundle: nothing (the app appends the path
// at runtime), or one of the allowed pages.
const LEGAL_LINK_PATH = /^(?:\/(?:terms|privacy|delete-account)\/?)?(?![\w./-])/;
const SRC_EXT = /\.(ts|tsx|js|jsx|mjs|css|html)$/;

function apiOrigins(raw) {
  if (!raw) return [];
  try {
    const u = new URL(raw);
    if (u.protocol !== "https:" && u.protocol !== "http:") return [];
    return [u.origin, u.origin.replace(/^http/, "ws")];
  } catch {
    return [];
  }
}

function walk(path, visit) {
  if (!existsSync(path)) return;
  if (statSync(path).isDirectory()) for (const e of readdirSync(path)) walk(join(path, e), visit);
  else visit(path);
}

function hostOf(url) {
  try {
    return new URL(url.replace(/^ws/i, "http")).host;
  } catch {
    return "";
  }
}

const inert = (host) => INERT_HOSTS.some((h) => host === h || host.endsWith(`.${h}`));

/** `loadEnv` is passed in by the app script: `vite` resolves from the app's
 * node_modules, not from shared/. `mapbox`: the app has the interactive map
 * (client, driver); admin never passes it, so its rules never change. */
export function checkNoNetwork({ loadEnv, appDir = process.cwd(), mapbox = false }) {
  const sharedDir = resolve(appDir, "../shared");
  const env = loadEnv("production", appDir, "VITE_");
  const demoMode = env.VITE_DEMO_MODE === "true";
  const allowedOrigins = demoMode ? [] : apiOrigins((env.VITE_API_URL ?? "").trim());
  // The build contains the map: the app has one and the token is set.
  const mapboxOn = mapbox && (env.VITE_MAPBOX_TOKEN ?? "").trim() !== "";
  // Files that may call the network in http mode (everything else: never).
  const transport = new Set(["client.ts", "realtime.ts", "devProbe.ts"].map((f) => join(sharedDir, "http", f)));
  // The map's own transport: the only files that may import mapbox-gl, call
  // fetch for Directions or name the Mapbox host.
  const mapRuntime = join(sharedDir, "map", "mapboxRuntime.ts");
  // (provider.types.ts: type-only imports, erased at build time.)
  const mapTransport = new Set(["mapboxRuntime.ts", "provider.mapbox.ts", "provider.types.ts", "directions.ts"].map((f) => join(sharedDir, "map", f)));
  // The one source file that may name the public site (bare origin only).
  const siteConfig = join(appDir, "src", "config.ts");
  const violations = [];
  const rel = (p) => relative(appDir, p).split(sep).join("/");

  // -------------------------------------------------------------- 1. source
  const scanSource = (path) => {
    if (!SRC_EXT.test(path) || /\.test\.ts$/.test(path)) return;
    const text = readFileSync(path, "utf-8");
    const inMap = mapTransport.has(path);
    for (const [re, label] of THIRD_PARTY) if (re.test(text)) violations.push(`${rel(path)}: contains "${label}"`);
    for (const m of text.matchAll(EXTERNAL_URL)) {
      if (inMap && isMapboxHost(hostOf(m[0]))) continue;
      if (path === siteConfig && m[0].toLowerCase() === LEGAL_LINK_ORIGIN && !/^[\w./:-]/.test(text.slice(m.index + m[0].length))) continue;
      violations.push(`${rel(path)}: contains "hardcoded external URL" (${m[0]})`);
    }
    if (!inMap && MAPBOX_IMPORT.test(text)) violations.push(`${rel(path)}: imports mapbox-gl outside the map transport (shared/map/mapboxRuntime.ts)`);
    if (transport.has(path) || path === mapRuntime) return;
    for (const [re, label] of NETWORK_CALLS) {
      if (re.test(text)) violations.push(`${rel(path)}: "${label}" outside the shared transport (shared/http)`);
    }
  };
  for (const root of ["src", "index.html"]) walk(join(appDir, root), scanSource);
  for (const root of ["http", "api", "map"]) walk(join(sharedDir, root), scanSource);

  // --------------------------------------------------------------- 2. build
  const dist = join(appDir, "dist");
  const scannedBuild = existsSync(join(dist, "index.html"));
  if (scannedBuild) {
    walk(dist, (path) => {
      if (!/\.(js|html|css)$/.test(path)) return;
      const text = readFileSync(path, "utf-8");
      // With the map built in, its chunk is the one place that may hold
      // network code in a demo build and name the Mapbox hosts; index.html
      // names them in its CSP.
      const mapChunk = mapboxOn && MAPBOX_CHUNK.test(rel(path));
      const mapHostsAllowed = mapChunk || (mapboxOn && rel(path) === "dist/index.html");
      if (demoMode && !mapChunk) {
        for (const [re, label] of NETWORK_CALLS) {
          if (re.test(text)) violations.push(`${rel(path)}: "${label}" in a VITE_DEMO_MODE=true build`);
        }
      }
      for (const m of text.matchAll(/\b(?:https?|wss?):\/\/[a-z0-9.-]+(?::\d+)?/gi)) {
        const url = m[0];
        const host = hostOf(url);
        if (allowedOrigins.includes(url.toLowerCase()) || inert(host)) continue;
        if (url.toLowerCase() === LEGAL_LINK_ORIGIN && LEGAL_LINK_PATH.test(text.slice(m.index + url.length))) continue;
        if (mapHostsAllowed && isMapboxHost(host)) continue;
        if (mapChunk && MAPBOX_CHUNK_INERT_HOSTS.includes(host)) continue;
        violations.push(`${rel(path)}: reaches "${url}" (allowed: ${allowedOrigins.join(", ") || "none"})`);
      }
    });

    const expected = ["'self'", ...allowedOrigins, ...(mapboxOn ? MAPBOX_CONNECT_SRC : [])];
    const checkConnectSrc = (label, policy) => {
      const m = /connect-src ([^;]*)/.exec(policy ?? "");
      if (!m) return violations.push(`${label}: no connect-src`);
      const got = m[1].trim().split(/\s+/);
      if (got.length !== expected.length || !got.every((s) => expected.includes(s))) {
        violations.push(`${label}: connect-src is "${m[1].trim()}", expected "${expected.join(" ")}" for this env — rebuild`);
      }
    };
    const html = readFileSync(join(dist, "index.html"), "utf-8");
    checkConnectSrc("dist/index.html <meta> CSP", /http-equiv="Content-Security-Policy"\s+content="([^"]*)"/.exec(html)?.[1]);
    const headers = join(dist, "_headers");
    if (existsSync(headers)) checkConnectSrc("dist/_headers", /Content-Security-Policy: (.*)/.exec(readFileSync(headers, "utf-8"))?.[1]);
    else violations.push("dist/_headers missing — rebuild");
  }

  const mode =
    (demoMode ? "VITE_DEMO_MODE=true (no network)" : `http mode, API origin: ${allowedOrigins[0] ?? "none (VITE_API_URL empty)"}`) +
    (mapboxOn ? " + Mapbox map" : "");
  if (violations.length > 0) {
    console.error(`check:no-network FAILED [${mode}]:\n`);
    for (const v of violations) console.error("  " + v);
    process.exit(1);
  }
  console.log(`check:no-network passed [${mode}] — sources${scannedBuild ? " and dist/" : " (no dist/ yet: run npm run build to scan the bundle)"}.`);
}
