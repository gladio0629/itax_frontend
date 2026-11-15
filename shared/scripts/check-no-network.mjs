// check:no-network for all three apps; each app's scripts/check-no-network.mjs
// calls checkNoNetwork(). Mode comes from the same env Vite uses for a
// production build (shell/host env > .env.production > .env):
//   VITE_DEMO_MODE=true  → no network code at all (mock adapter only).
//   otherwise (http)     → network code only in the shared transport files,
//                          and the only origin it may reach is VITE_API_URL.
//
// 1. Source scan (src/, index.html, ../shared/http, ../shared/api): no
//    third-party hosts, and fetch / WebSocket / XHR only in the transport
//    allowlist below.
// 2. Build scan (dist/, when present): in demo mode the bundle has no
//    fetch/WebSocket; every absolute URL is either the API origin (http
//    mode) or a known non-network string (XML namespaces, React's error
//    docs); index.html and _headers allow connect-src 'self' + the API
//    origin only, and match the current env (else: rebuild).
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
  [/mapbox/i, "mapbox"],
  [/fonts\.gstatic/, "fonts.gstatic"],
  [/cdn\.jsdelivr/, "cdn.jsdelivr"],
  [/unpkg\.com/, "unpkg.com"],
  [/sentry\.io/, "sentry.io"],
  [/google-analytics/, "google-analytics"],
  // example.com is reserved (RFC 2606) and only appears in hints.
  [/\bhttps?:\/\/(?!localhost\b|127\.0\.0\.1\b|(?:[a-z0-9-]+\.)*example\.com\b)[a-z0-9.-]+/i, "hardcoded external URL"],
];
// Absolute URLs that occur in third-party bundles as plain text (XML
// namespaces, React/router error links). They are never requested.
const INERT_HOSTS = ["www.w3.org", "reactjs.org", "react.dev", "fb.me", "github.com", "localhost", "127.0.0.1", "example.com"];
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
 * node_modules, not from shared/. */
export function checkNoNetwork({ loadEnv, appDir = process.cwd() }) {
  const sharedDir = resolve(appDir, "../shared");
  const env = loadEnv("production", appDir, "VITE_");
  const demoMode = env.VITE_DEMO_MODE === "true";
  const allowedOrigins = demoMode ? [] : apiOrigins((env.VITE_API_URL ?? "").trim());
  // Files that may call the network in http mode (everything else: never).
  const transport = new Set(["client.ts", "realtime.ts", "devProbe.ts"].map((f) => join(sharedDir, "http", f)));
  const violations = [];
  const rel = (p) => relative(appDir, p).split(sep).join("/");

  // -------------------------------------------------------------- 1. source
  const scanSource = (path) => {
    if (!SRC_EXT.test(path) || /\.test\.ts$/.test(path)) return;
    const text = readFileSync(path, "utf-8");
    for (const [re, label] of THIRD_PARTY) if (re.test(text)) violations.push(`${rel(path)}: contains "${label}"`);
    if (transport.has(path)) return;
    for (const [re, label] of NETWORK_CALLS) {
      if (re.test(text)) violations.push(`${rel(path)}: "${label}" outside the shared transport (shared/http)`);
    }
  };
  for (const root of ["src", "index.html"]) walk(join(appDir, root), scanSource);
  for (const root of ["http", "api"]) walk(join(sharedDir, root), scanSource);

  // --------------------------------------------------------------- 2. build
  const dist = join(appDir, "dist");
  const scannedBuild = existsSync(join(dist, "index.html"));
  if (scannedBuild) {
    walk(dist, (path) => {
      if (!/\.(js|html|css)$/.test(path)) return;
      const text = readFileSync(path, "utf-8");
      if (demoMode) {
        for (const [re, label] of NETWORK_CALLS) {
          if (re.test(text)) violations.push(`${rel(path)}: "${label}" in a VITE_DEMO_MODE=true build`);
        }
      }
      for (const m of text.matchAll(/\b(?:https?|wss?):\/\/[a-z0-9.-]+(?::\d+)?/gi)) {
        const url = m[0];
        if (allowedOrigins.includes(url.toLowerCase()) || inert(hostOf(url))) continue;
        violations.push(`${rel(path)}: reaches "${url}" (allowed: ${allowedOrigins.join(", ") || "none"})`);
      }
    });

    const expected = ["'self'", ...allowedOrigins];
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

  const mode = demoMode ? "VITE_DEMO_MODE=true (no network)" : `http mode, API origin: ${allowedOrigins[0] ?? "none (VITE_API_URL empty)"}`;
  if (violations.length > 0) {
    console.error(`check:no-network FAILED [${mode}]:\n`);
    for (const v of violations) console.error("  " + v);
    process.exit(1);
  }
  console.log(`check:no-network passed [${mode}] — sources${scannedBuild ? " and dist/" : " (no dist/ yet: run npm run build to scan the bundle)"}.`);
}
