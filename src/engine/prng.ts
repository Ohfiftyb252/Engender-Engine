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

export function advancePRNG(rng: () => number, steps: number): void {
  for (let i = 0; i < steps; i++) rng();
}

export function randInt(rng: () => number, min: number, max: number): number {
  return Math.floor(rng() * (max - min + 1)) + min;
}

export function randPick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)];
}

export function createSeedBranches(masterSeed: number) {
  return {
    rhythm:          mulberry32(masterSeed ^ 0x1a2b3c4d),
    chords:          mulberry32(masterSeed ^ 0x5e6f7a8b),
    melody:          mulberry32(masterSeed ^ 0x9c0d1e2f),
    bass:            mulberry32(masterSeed ^ 0x3a4b5c6d),
    // Separate humanize streams per voice — mutating one voice must not
    // shift the RNG state for another voice's humanization.
    humanizeChords:  mulberry32(masterSeed ^ 0x7e8f9a0b),
    humanizeMelody:  mulberry32(masterSeed ^ 0xb1c2d3e4),
    humanizeBass:    mulberry32(masterSeed ^ 0xf5a6b7c8),
    drums:           mulberry32(masterSeed ^ 0xc1d2e3f4),
  };
}
