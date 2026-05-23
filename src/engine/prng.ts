/**
 * Mulberry32 — fast, deterministic 32-bit PRNG.
 * Returns a factory that yields floats in [0, 1).
 */
export function mulberry32(seed: number): () => number {
  let s = seed >>> 0;
  return function () {
    s = (s + 0x6d2b79f5) >>> 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  };
}

/** Advance a PRNG n steps (for cheap branch forking). */
export function advancePRNG(rng: () => number, steps: number): void {
  for (let i = 0; i < steps; i++) rng();
}

/** Pick a random integer in [min, max] inclusive. */
export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

/** Pick a random element from an array. */
export function randPick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

/** Seed branches — each gets its own independent RNG. */
export function createSeedBranches(masterSeed: number) {
  return {
    rhythm:    mulberry32(masterSeed ^ 0x1a2b3c4d),
    chords:    mulberry32(masterSeed ^ 0x5e6f7a8b),
    melody:    mulberry32(masterSeed ^ 0x9c0d1e2f),
    bass:      mulberry32(masterSeed ^ 0x3a4b5c6d),
    humanize:  mulberry32(masterSeed ^ 0x7e8f9a0b),
  };
}
