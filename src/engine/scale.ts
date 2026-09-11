import type { MidiEvent, ScaleType } from '../types';

export const SCALE_INTERVALS: Record<ScaleType, number[]> = {
  // Existing (kept for snapshot backward-compat)
  harmonicMinor:    [0, 2, 3, 5, 7, 8, 11],
  phrygian:         [0, 1, 3, 5, 7, 8, 10],
  phrygianDominant: [0, 1, 4, 5, 7, 8, 10],
  aeolian:          [0, 2, 3, 5, 7, 8, 10],

  // Major family
  majorBebop:       [0, 2, 4, 5, 7, 8, 9, 11],  // major + chromatic #5 passing tone
  majorBulgarian:   [0, 1, 4, 6, 7, 9, 10],
  majorPentatonic:  [0, 2, 4, 7, 9],
  majorPersian:     [0, 1, 4, 5, 6, 8, 11],
  majorPolymode:    [0, 2, 4, 6, 7, 9, 10],      // Lydian dominant
  lydian:           [0, 2, 4, 6, 7, 9, 11],
  mixolydian:       [0, 2, 4, 5, 7, 9, 10],

  // Minor family
  minorHungarian:   [0, 2, 3, 6, 7, 8, 11],
  minorMelodic:     [0, 2, 3, 5, 7, 9, 11],      // jazz melodic minor (ascending)
  minorNatural:     [0, 2, 3, 5, 7, 8, 10],      // = aeolian
  minorNeapolitan:  [0, 1, 3, 5, 7, 8, 11],
  minorPentatonic:  [0, 3, 5, 7, 10],
  minorPolymode:    [0, 2, 3, 5, 7, 8, 9, 10],   // natural minor + raised 6th color
  minorRomanian:    [0, 2, 3, 6, 7, 9, 10],      // Dorian #4
  dorian:           [0, 2, 3, 5, 7, 9, 10],
  locrian:          [0, 1, 3, 5, 6, 8, 10],

  // World / special
  chromatic:        [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
  arabic:           [0, 2, 4, 5, 6, 8, 10],
  blues:            [0, 3, 5, 6, 7, 10],         // minor blues with b5 blue note
  diminished:       [0, 2, 3, 5, 6, 8, 9, 11],  // octatonic whole-half
  dominantBebop:    [0, 2, 4, 5, 7, 9, 10, 11],  // Mixolydian + natural 7
  egyptian:         [0, 2, 5, 7, 10],            // suspended pentatonic
  enigmatic:        [0, 1, 4, 6, 8, 10, 11],
  hirajoshi:        [0, 4, 6, 7, 11],
  iwato:            [0, 1, 5, 6, 10],
  japaneseInsen:    [0, 1, 5, 7, 10],
  locrianSuper:     [0, 1, 3, 4, 6, 8, 10],     // altered / super-locrian
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

export function validateScaleNotes(events: MidiEvent[], key: number, scale: ScaleType): {
  total: number;
  inScale: number;
  passingTones: number;
} {
  const intervals = SCALE_INTERVALS[scale];
  let inScale = 0;
  let passing = 0;
  const uniquePitches = new Set(events.map(e => e.pitch));
  for (const pitch of uniquePitches) {
    const pc = ((pitch - key) % 12 + 12) % 12;
    if (intervals.includes(pc)) inScale++;
    else passing++;
  }
  return { total: uniquePitches.size, inScale, passingTones: passing };
}
