import type { ScaleType } from '../types';

/** Semitone intervals from root (within one octave). */
export const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  harmonicMinor:    [0, 2, 3, 5, 7, 8, 11],
  phrygian:         [0, 1, 3, 5, 7, 8, 10],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  aeolian:          [0, 2, 3, 5, 7, 8, 10],
};

/**
 * Build all MIDI pitches belonging to a scale within [minPitch, maxPitch].
 * key: 0=C, 1=C#, 2=D … 11=B
 */
export function buildScalePitches(
  key: number,
  scale: ScaleType,
  minPitch: number,
  maxPitch: number,
): number[] {
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

/** Note names for display. */
export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];

export function noteName(key: number): string {
  return NOTE_NAMES[key % 12];
}

/**
 * 80% chance: return a scale degree. 20% chance: return a chromatic surprise
 * that is NOT in the scale (adds tension).
 */
export function pickPitchWithBias(
  rng: () => number,
  scalePitches: number[],
  allPitches: number[],
): number {
  if (rng() < 0.8 || allPitches.length === 0) {
    return scalePitches[Math.floor(rng() * scalePitches.length)];
  }
  const outside = allPitches.filter(p => !scalePitches.includes(p));
  if (outside.length === 0) return scalePitches[Math.floor(rng() * scalePitches.length)];
  return outside[Math.floor(rng() * outside.length)];
}
