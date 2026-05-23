import type { DNAProfile, GenreProfile, MidiEvent, ScaleType } from '../types';
import { buildScalePitches } from './scale';
import { buildRhythmGrid } from './grid';
import { randPick, randInt } from './prng';

const CHORD_MIN = 36;
const CHORD_MAX = 60;

export function generateChords(rng: () => number, dna: DNAProfile, genre: GenreProfile, key: number, scale: ScaleType): MidiEvent[] {
  const scalePitches = buildScalePitches(key, scale, CHORD_MIN, CHORD_MAX);
  if (scalePitches.length === 0) return [];

  const targetChords = Math.round(genre.chordDensity * 4 * (1 - dna.rhythmGapBias * 0.5));
  const grid = buildRhythmGrid(rng, dna, genre, Math.max(2, targetChords), false);
  const events: MidiEvent[] = [];
  const [velMin, velMax] = genre.velocityRange;

  const rootPitches  = scalePitches.filter(p => (p - key + 12) % 12 === 0);
  const fifthPitches = scalePitches.filter(p => (p - key + 12) % 12 === 7);
  const thirdPitches = scalePitches.filter(p => (p - key + 12) % 12 === 3);
  const anchors = [...rootPitches, ...rootPitches, ...fifthPitches, ...thirdPitches]
    .filter(p => p >= CHORD_MIN && p <= CHORD_MAX - 4);
  if (anchors.length === 0) return [];

  let prevRoot = -1;
  let prevInterval = -1;

  for (const slot of grid) {
    if (!slot.active) continue;
    let root = randPick(rng, anchors);
    let attempts = 0;
    while (root === prevRoot && attempts < 8) { root = randPick(rng, anchors); attempts++; }
    prevRoot = root;

    const velocity = Math.max(40, Math.min(127, randInt(rng, velMin, velMax) - Math.round(dna.velocityVariance * (rng() - 0.5))));
    const duration = Math.max(2, slot.duration * 2);
    const r = rng();

    if (r < 0.5) {
      const fifth = root + 7;
      events.push({ position: slot.position, pitch: root, duration, velocity });
      if (fifth <= CHORD_MAX) events.push({ position: slot.position, pitch: fifth, duration, velocity: Math.max(40, velocity - 8) });
    } else if (r < 0.8) {
      const third = root + 3;
      const fifth = root + 7;
      events.push({ position: slot.position, pitch: root, duration, velocity });
      if (third <= CHORD_MAX) events.push({ position: slot.position, pitch: third, duration, velocity: Math.max(40, velocity - 10) });
      if (fifth <= CHORD_MAX) events.push({ position: slot.position, pitch: fifth, duration, velocity: Math.max(40, velocity - 6) });
    } else {
      let interval = randPick(rng, [3, 4, 7, 10, 11]);
      while (interval === prevInterval && rng() < 0.7) interval = randPick(rng, [3, 4, 7, 10, 11]);
      prevInterval = interval;
      const note = root + interval;
      events.push({ position: slot.position, pitch: root, duration, velocity });
      if (note <= CHORD_MAX) events.push({ position: slot.position, pitch: note, duration, velocity: Math.max(40, velocity - 12) });
    }
  }
  return events;
}
