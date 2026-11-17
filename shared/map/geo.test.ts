// node --test 'shared/**/*.test.ts'
import assert from "node:assert/strict";
import { test } from "node:test";
import { TASHKENT, boundsOf, distanceM, isLatLng, offsetPoint, pathFrom, pathLengthM, pointAlong, pointsKey, toLatLng, toLngLat } from "./geo.ts";

const SAMARKAND = { lat: 39.6542, lng: 66.9597 };

test("default centre is Tashkent, as Mapbox [lng, lat]", () => {
  assert.deepEqual(toLngLat(TASHKENT), [69.2401, 41.2995]);
});

test("distanceM matches the backend's Haversine", () => {
  // onlyback/shared/geo/geo_test.go: Toshkent – Samarqand 265 826.13 m
  assert.ok(Math.abs(distanceM(TASHKENT, SAMARKAND) - 265_826.13) < 1);
  assert.equal(distanceM(TASHKENT, TASHKENT), 0);
  assert.ok(Math.abs(distanceM({ lat: 0, lng: 0 }, { lat: 1, lng: 0 }) - 111_194.927) < 0.01);
});

test("isLatLng and toLatLng reject unusable coordinates", () => {
  assert.equal(isLatLng({ lat: 41.3, lng: 69.2 }), true);
  for (const bad of [null, undefined, {}, { lat: 91, lng: 0 }, { lat: 0, lng: 181 }, { lat: NaN, lng: 0 }, { lat: "41", lng: "69" }]) {
    assert.equal(isLatLng(bad), false);
  }
  // WebSocket frames carry strings.
  assert.deepEqual(toLatLng("41.31", "69.28"), { lat: 41.31, lng: 69.28 });
  assert.deepEqual(toLatLng(41.31, 69.28), { lat: 41.31, lng: 69.28 });
  for (const [lat, lng] of [["", "69"], ["abc", "69"], [undefined, 69], [95, 69], [null, null]] as const) {
    assert.equal(toLatLng(lat, lng), null);
  }
});

test("pointAlong walks a path by distance", () => {
  const path = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 1 },
    { lat: 0, lng: 3 },
  ];
  assert.deepEqual(pointAlong(path, 0), path[0]);
  assert.deepEqual(pointAlong(path, 1), path[2]);
  const mid = pointAlong(path, 0.5)!;
  assert.ok(Math.abs(mid.lng - 1.5) < 1e-6 && Math.abs(mid.lat) < 1e-9);
  // Out-of-range and broken input is clamped, never thrown.
  assert.deepEqual(pointAlong(path, -1), path[0]);
  assert.deepEqual(pointAlong(path, 7), path[2]);
  assert.deepEqual(pointAlong(path, NaN), path[0]);
  assert.equal(pointAlong([], 0.5), null);
  assert.deepEqual(pointAlong([TASHKENT], 0.5), TASHKENT);
  // A path with a repeated point doesn't divide by zero.
  assert.deepEqual(pointAlong([path[0], path[0], path[1]], 1), path[1]);
});

test("pathFrom keeps what is still ahead", () => {
  const path = [
    { lat: 0, lng: 0 },
    { lat: 0, lng: 1 },
    { lat: 0, lng: 2 },
  ];
  const rest = pathFrom(path, 0.25);
  assert.equal(rest.length, 3);
  assert.ok(Math.abs(rest[0].lng - 0.5) < 1e-6);
  assert.deepEqual(rest.slice(1), path.slice(1));
  assert.ok(Math.abs(pathLengthM(rest) - pathLengthM(path) * 0.75) < 1);
  assert.deepEqual(pathFrom(path, 0), path);
  assert.deepEqual(pathFrom(path, 1), [path[2]]);
});

test("offsetPoint moves by metres", () => {
  const p = offsetPoint(TASHKENT, 1000, -500);
  assert.ok(Math.abs(distanceM(TASHKENT, p) - Math.hypot(1000, 500)) < 2);
  assert.ok(p.lng > TASHKENT.lng && p.lat < TASHKENT.lat);
});

test("boundsOf is [[west, south], [east, north]]", () => {
  assert.deepEqual(boundsOf([TASHKENT, SAMARKAND]), [
    [66.9597, 39.6542],
    [69.2401, 41.2995],
  ]);
  assert.equal(boundsOf([]), null);
  assert.deepEqual(boundsOf([TASHKENT, { lat: 999, lng: 0 }]), [
    [69.2401, 41.2995],
    [69.2401, 41.2995],
  ]);
});

test("pointsKey changes only when a point really moves", () => {
  assert.equal(pointsKey([TASHKENT, null]), "41.29950,69.24010;-");
  assert.equal(pointsKey([{ lat: 41.2995001, lng: 69.2401 }]), pointsKey([TASHKENT]));
  assert.notEqual(pointsKey([{ lat: 41.2996, lng: 69.2401 }]), pointsKey([TASHKENT]));
});
