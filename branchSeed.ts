export function seededRandom(seedString: string): () => number {
  let h = 2166136261 >>> 0;

  for (let i = 0; i < seedString.length; i++) {
    h = Math.imul(h ^ seedString.charCodeAt(i), 16777619);
  }

  return function () {
    let t = (h += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export interface SeedBranches {
  rhythm: () => number;
  chord: () => number;
  melody: () => number;
  bass: () => number;
  humanize: () => number;
}

export function initializeSeedBranches(masterSeed: string): SeedBranches {
  return {
    rhythm: seededRandom(`${masterSeed}_rhythm`),
    chord: seededRandom(`${masterSeed}_chords`),
    melody: seededRandom(`${masterSeed}_melody`),
    bass: seededRandom(`${masterSeed}_bass`),
    humanize: seededRandom(`${masterSeed}_humanize`)
  };
}
