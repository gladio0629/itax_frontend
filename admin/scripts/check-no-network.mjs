import { readdirSync, statSync, readFileSync } from "node:fs";
import { join } from "node:path";

// Fails the build if any source file contains a call that could reach
// an external network host. The mock adapter never uses these APIs —
// it only reads/writes localStorage and uses setTimeout to fake latency.
const FORBIDDEN = [
  [/\bfetch\s*\(/, "fetch("],
  [/\baxios\b/, "axios"],
  [/XMLHttpRequest/, "XMLHttpRequest"],
  [/\bnew\s+WebSocket\s*\(/, "WebSocket("],
  [/EventSource\s*\(/, "EventSource("],
  [/googleapis\.com/, "googleapis.com"],
  [/maps\.google/, "maps.google"],
  [/mapbox/i, "mapbox"],
  [/fonts\.googleapis/, "fonts.googleapis"],
  [/fonts\.gstatic/, "fonts.gstatic"],
  [/cdn\.jsdelivr/, "cdn.jsdelivr"],
  [/unpkg\.com/, "unpkg.com"],
  [/sentry\.io/, "sentry.io"],
  [/google-analytics/, "google-analytics"],
  [/\bhttps?:\/\/(?!localhost|127\.0\.0\.1)[a-z0-9.-]+/i, "hardcoded external URL"],
];

const SCAN_EXT = /\.(ts|tsx|js|jsx|css|html)$/;
const roots = ["src", "index.html"];
let violations = [];

function scanFile(path) {
  const content = readFileSync(path, "utf-8");
  for (const [pattern, label] of FORBIDDEN) {
    if (pattern.test(content)) {
      violations.push(`${path}: contains "${label}"`);
    }
  }
}

function walk(path) {
  const stat = statSync(path);
  if (stat.isDirectory()) {
    for (const entry of readdirSync(path)) {
      walk(join(path, entry));
    }
  } else if (SCAN_EXT.test(path)) {
    scanFile(path);
  }
}

for (const root of roots) {
  try {
    walk(root);
  } catch {
    // root doesn't exist, skip
  }
}

if (violations.length > 0) {
  console.error("check:no-network FAILED — external network calls detected:\n");
  for (const v of violations) console.error("  " + v);
  process.exit(1);
}

console.log("check:no-network passed — no external network calls found.");
