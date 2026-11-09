// Deterministic seeded PRNG (mulberry32). Using a fixed seed means the
// generated seed dataset is byte-for-byte identical every run, and — because
// this exact file is copied unchanged into all three IZGO apps — identical
// across apps too (same names, routes, drivers).
export function mulberry32(seed: number) {
  let a = seed;
  return function random() {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function makeRng(seed = 1_337_042) {
  const rnd = mulberry32(seed);
  return {
    next: () => rnd(),
    int: (min: number, max: number) => Math.floor(rnd() * (max - min + 1)) + min,
    float: (min: number, max: number, decimals = 1) => {
      const v = rnd() * (max - min) + min;
      const p = 10 ** decimals;
      return Math.round(v * p) / p;
    },
    pick: <T>(arr: readonly T[]): T => arr[Math.floor(rnd() * arr.length)],
    bool: (probability = 0.5) => rnd() < probability,
    shuffle: <T>(arr: readonly T[]): T[] => {
      const copy = [...arr];
      for (let i = copy.length - 1; i > 0; i--) {
        const j = Math.floor(rnd() * (i + 1));
        [copy[i], copy[j]] = [copy[j], copy[i]];
      }
      return copy;
    },
  };
}
