import type { ScaleType } from '../types';

export const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  harmonicMinor:    [0, 2, 3, 5, 7, 8, 11],
  phrygian:         [0, 1, 3, 5, 7, 8, 10],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  aeolian:          [0, 2, 3, 5, 7, 8, 10],
};

export function buildScalePitches(key: number, scale: ScaleType, minPitch: number, maxPitch: number): number[] {
  const intervals = SCALE_INTERVALS[scale];
  const pitches: number[] = [];
  for (let oct = 0; oct < 11; oct++) {
    for (const interval of intervals) {
      const pitch = oct * 12 + key + interval;
      if (pitch >= minPitch && pitch <= maxPitch) pitches.push(pitch);
    }
  }
  return pitches;
}

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteName(key: number): string {
  return NOTE_NAMES[key % 12];
}

export function pickPitchWithBias(rng: () => number, scalePitches: number[], allPitches: number[]): number {
  if (rng() < 0.8 || allPitches.length === 0) {
    return scalePitches[Math.floor(rng() * scalePitches.length)];
  }
  const outside = allPitches.filter(p => !scalePitches.includes(p));
  if (outside.length === 0) return scalePitches[Math.floor(rng() * scalePitches.length)];
  return outside[Math.floor(rng() * outside.length)];
}
