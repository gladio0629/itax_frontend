// node --test 'shared/**/*.test.ts'
import assert from "node:assert/strict";
import { test } from "node:test";
import { createDirections, directionsUrl, parseDirections, type FetchLike } from "./directions.ts";
import { straightRoute } from "./route.ts";
import { distanceM } from "./geo.ts";

// A made-up value: the real token only ever comes from VITE_MAPBOX_TOKEN.
const TOKEN = "pk.test-token-not-real";
const A = { lat: 41.3111, lng: 69.2797 };
const B = { lat: 41.2995, lng: 69.2401 };

const okBody = {
  code: "Ok",
  routes: [
    {
      distance: 5849.2,
      duration: 757.1,
      geometry: {
        type: "LineString",
        coordinates: [
          [69.2797, 41.3111],
          [69.26, 41.305],
          [69.2401, 41.2995],
        ],
      },
    },
  ],
};

/** A fetch stand-in that records its calls. */
function mockFetch(reply: (url: string) => { ok?: boolean; status?: number; body?: unknown } | Promise<never>) {
  const calls: string[] = [];
  const fetchImpl: FetchLike = async (url) => {
    calls.push(url);
    const r = await reply(url);
    return { ok: r.ok ?? true, status: r.status ?? 200, json: async () => r.body };
  };
  return { calls, fetchImpl };
}

test("directionsUrl: driving profile, longitude first, full GeoJSON geometry", () => {
  const url = new URL(directionsUrl([A, B], TOKEN));
  assert.equal(url.origin + url.pathname, "https://api.mapbox.com/directions/v5/mapbox/driving/69.279700,41.311100;69.240100,41.299500");
  assert.equal(url.searchParams.get("access_token"), TOKEN);
  assert.equal(url.searchParams.get("geometries"), "geojson");
  assert.equal(url.searchParams.get("overview"), "full");
});

test("parseDirections reads routes[0]", () => {
  const r = parseDirections(okBody)!;
  assert.equal(r.source, "mapbox");
  assert.equal(r.distanceM, 5849.2);
  assert.equal(r.durationS, 757.1);
  assert.deepEqual(r.path[0], A);
  assert.deepEqual(r.path[2], B);
});

test("parseDirections rejects anything without a usable route", () => {
  const bad: unknown[] = [
    null,
    "text",
    { code: "NoRoute", routes: [] },
    { code: "Ok", routes: [] },
    { code: "Ok", routes: [{ distance: 1, duration: 1 }] },
    { code: "Ok", routes: [{ geometry: { coordinates: [[69.2, 41.3]] } }] },
    { code: "Ok", routes: [{ geometry: { coordinates: [[69.2, 41.3], ["x", 1]] } }] },
    { code: "Ok", routes: [{ geometry: { coordinates: [[69.2, 41.3], [500, 41.3]] } }] },
  ];
  for (const body of bad) assert.equal(parseDirections(body), null);
});

test("route(): the road line from Mapbox", async () => {
  const { calls, fetchImpl } = mockFetch(() => ({ body: okBody }));
  const r = await createDirections({ token: TOKEN, fetchImpl }).route([A, B]);
  assert.equal(r.source, "mapbox");
  assert.equal(r.path.length, 3);
  assert.equal(calls.length, 1);
  assert.ok(calls[0].startsWith("https://api.mapbox.com/directions/v5/mapbox/driving/"));
});

test("route(): falls back to a straight line and never rejects", async () => {
  const cases: Record<string, Parameters<typeof mockFetch>[0]> = {
    "HTTP 401": () => ({ ok: false, status: 401, body: { message: "Not Authorized" } }),
    "HTTP 503": () => ({ ok: false, status: 503 }),
    NoRoute: () => ({ body: { code: "NoRoute", routes: [] } }),
    "not JSON": () => ({ body: undefined }),
    offline: () => Promise.reject(new TypeError("Failed to fetch")),
  };
  for (const [name, reply] of Object.entries(cases)) {
    const { fetchImpl } = mockFetch(reply);
    const r = await createDirections({ token: TOKEN, fetchImpl }).route([A, B]);
    assert.equal(r.source, "straight", name);
    assert.deepEqual(r.path, [A, B], name);
    assert.ok(Math.abs(r.distanceM - distanceM(A, B)) < 1e-6, name);
  }
});

test("route(): a slow answer times out to the straight line", async () => {
  const fetchImpl: FetchLike = (_url, init) =>
    new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  const r = await createDirections({ token: TOKEN, fetchImpl, timeoutMs: 20 }).route([A, B]);
  assert.equal(r.source, "straight");
});

test("route(): no request without a token or with unusable points", async () => {
  const { calls, fetchImpl } = mockFetch(() => ({ body: okBody }));
  assert.equal((await createDirections({ token: "", fetchImpl }).route([A, B])).source, "straight");
  const d = createDirections({ token: TOKEN, fetchImpl });
  assert.deepEqual((await d.route([A])).path, [A]);
  assert.deepEqual((await d.route([A, { lat: NaN, lng: 1 }])).path, [A]);
  assert.equal(calls.length, 0);
});

test("route(): one request per distinct route; failures aren't cached", async () => {
  let fail = true;
  const { calls, fetchImpl } = mockFetch(() => (fail ? { ok: false, status: 500 } : { body: okBody }));
  const d = createDirections({ token: TOKEN, fetchImpl });
  assert.equal((await d.route([A, B])).source, "straight");
  fail = false;
  const [r1, r2] = await Promise.all([d.route([A, B]), d.route([A, B])]);
  assert.equal(r1.source, "mapbox");
  assert.equal(r2, r1);
  await d.route([A, B]);
  assert.equal(calls.length, 2); // the failed try + one shared success
  await d.route([B, A]);
  assert.equal(calls.length, 3);
});

test("route(): an aborted caller gets the straight line", async () => {
  // The request itself is still running when the caller gives up.
  const fetchImpl: FetchLike = (_url, init) =>
    new Promise((_resolve, reject) => init.signal?.addEventListener("abort", () => reject(new DOMException("aborted", "AbortError"))));
  const d = createDirections({ token: TOKEN, fetchImpl, timeoutMs: 300 });
  const ctl = new AbortController();
  const pending = d.route([A, B], ctl.signal);
  ctl.abort();
  assert.equal((await pending).source, "straight");
  ctl.abort();
  assert.equal((await d.route([A, B], ctl.signal)).source, "straight");
});

test("straightRoute skips unusable points", () => {
  assert.deepEqual(straightRoute([A, { lat: 0, lng: 999 }, B]).path, [A, B]);
  assert.equal(straightRoute([]).distanceM, 0);
});
