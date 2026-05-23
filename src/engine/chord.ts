import type { DNAProfile, GenreProfile, MidiEvent } from '../types';
import type { ScaleType } from '../types';
import { buildScalePitches } from './scale';
import { buildRhythmGrid } from './grid';
import { randPick, randInt } from './prng';

/** Chord pocket: MIDI 36–60 */
const CHORD_MIN = 36;
const CHORD_MAX = 60;

export function generateChords(
  rng: () => number,
  dna: DNAProfile,
  genre: GenreProfile,
  key: number,
  scale: ScaleType,
): MidiEvent[] {
  const scalePitches = buildScalePitches(key, scale, CHORD_MIN, CHORD_MAX);
  if (scalePitches.length === 0) return [];

  const targetChords = Math.round(genre.chordDensity * 4 * (1 - dna.rhythmGapBias * 0.5));
  const grid = buildRhythmGrid(rng, dna, genre, Math.max(2, targetChords), false);

  const events: MidiEvent[] = [];
  const [velMin, velMax] = genre.velocityRange;

  // Root degrees within the scale (bias toward root, 4th, 5th positions)
  const rootPitches = scalePitches.filter(p => (p - key + 12) % 12 === 0);
  const fifthPitches = scalePitches.filter(p => (p - key + 12) % 12 === 7);
  const thirdPitches = scalePitches.filter(p => (p - key + 12) % 12 === 3);

  const anchors = [
    ...rootPitches,
    ...rootPitches,  // root gets double weight
    ...fifthPitches,
    ...thirdPitches,
  ].filter(p => p >= CHORD_MIN && p <= CHORD_MAX - 4);

  if (anchors.length === 0) return [];

  const [vel1] = genre.velocityRange;
  let prevRoot = -1;
  let prevInterval = -1;

  for (const slot of grid) {
    if (!slot.active) continue;

    // Sustained motion: don't repeat exact same chord twice in a row
    let root = randPick(rng, anchors);
    let attempts = 0;
    while (root === prevRoot && attempts < 8) {
      root = randPick(rng, anchors);
      attempts++;
    }
    prevRoot = root;

    const velocity = randInt(rng, velMin, velMax) - Math.round(dna.velocityVariance * (rng() - 0.5));
    const vel = Math.max(40, Math.min(127, velocity));
    const duration = Math.max(2, slot.duration * 2); // chords ring longer

    // Dyad preference: root + fifth (7 semitones) or root + minor-3rd (3 semitones)
    const r = rng();
    if (r < 0.5) {
      // Root + fifth dyad
      const fifth = root + 7;
      if (fifth <= CHORD_MAX) {
        events.push({ position: slot.position, pitch: root, duration, velocity: vel });
        events.push({ position: slot.position, pitch: fifth, duration, velocity: Math.max(40, vel - 8) });
      } else {
        events.push({ position: slot.position, pitch: root, duration, velocity: vel });
      }
    } else if (r < 0.8) {
      // Minor triad (root + minor3 + fifth)
      const third = root + 3;
      const fifth = root + 7;
      if (fifth <= CHORD_MAX) {
        events.push({ position: slot.position, pitch: root, duration, velocity: vel });
        if (third <= CHORD_MAX) events.push({ position: slot.position, pitch: third, duration, velocity: Math.max(40, vel - 10) });
        events.push({ position: slot.position, pitch: fifth, duration, velocity: Math.max(40, vel - 6) });
      } else {
        events.push({ position: slot.position, pitch: root, duration, velocity: vel });
      }
    } else {
      // Single note sustained (sparse, cinematic)
      let interval = randPick(rng, [3, 4, 7, 10, 11]);
      while (interval === prevInterval && rng() < 0.7) interval = randPick(rng, [3, 4, 7, 10, 11]);
      prevInterval = interval;
      const note = root + interval;
      events.push({ position: slot.position, pitch: root, duration, velocity: vel });
      if (note <= CHORD_MAX) events.push({ position: slot.position, pitch: note, duration, velocity: Math.max(40, vel - 12) });
    }

    // Subtle velocity nudge using dna variance
    void vel1;
  }

  return events;
}
