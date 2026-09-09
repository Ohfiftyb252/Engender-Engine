import type { DNAProfile, GenreProfile, MidiEvent, ScaleType } from '../types';
import { buildScalePitches } from './scale';
import { buildRhythmGrid } from './grid';
import { randPick, randInt } from './prng';

// Mid-range: chords live in C3–C5 so they sit above bass but below melody
const CHORD_MIN = 48; // C3
const CHORD_MAX = 72; // C5

export function generateChords(rng: () => number, dna: DNAProfile, genre: GenreProfile, key: number, scale: ScaleType, totalTicks = 64): MidiEvent[] {
  const scalePitches = buildScalePitches(key, scale, CHORD_MIN, CHORD_MAX);
  if (scalePitches.length === 0) return [];

  // Scale chord count proportionally to bar length (default is 64 ticks = 4 bars)
  const scaleFactor = totalTicks / 64;
  const targetChords = Math.max(4, Math.round(genre.chordDensity * (1 - dna.rhythmGapBias * 0.3) * scaleFactor));
  const grid = buildRhythmGrid(rng, dna, genre, targetChords, false, totalTicks);
  const events: MidiEvent[] = [];
  const [velMin, velMax] = genre.velocityRange;

  // Bias roots toward notes that make strong dark chord tones
  const rootPitches  = scalePitches.filter(p => (p - key + 12) % 12 === 0);
  const fifthPitches = scalePitches.filter(p => (p - key + 12) % 12 === 7);
  const thirdPitches = scalePitches.filter(p => ((p - key + 12) % 12 === 3 || (p - key + 12) % 12 === 4));
  // Weight roots heavily so chords feel grounded
  const anchors = [
    ...rootPitches, ...rootPitches, ...rootPitches,
    ...fifthPitches, ...fifthPitches,
    ...thirdPitches,
  ].filter(p => p >= CHORD_MIN && p <= CHORD_MAX - 12);
  if (anchors.length === 0) return [];

  let prevRoot = -1;

  for (const slot of grid) {
    if (!slot.active) continue;
    let root = randPick(rng, anchors);
    let attempts = 0;
    // Allow some chord repetition (hypnotic), but avoid always same root
    while (root === prevRoot && rng() < 0.6 && attempts < 6) { root = randPick(rng, anchors); attempts++; }
    prevRoot = root;

    const velocity = Math.max(45, Math.min(115, randInt(rng, velMin - 10, velMax - 10)));
    // Chords hold longer — gives that dark pad feel
    const duration = Math.max(4, slot.duration * 3);
    const r = rng();

    // Push a note at the root and various spread voicings above
    events.push({ position: slot.position, pitch: root, duration, velocity });

    if (r < 0.30) {
      // Power chord: root + fifth (most aggressive, cuts through)
      const fifth = root + 7;
      if (fifth <= CHORD_MAX) events.push({ position: slot.position, pitch: fifth, duration, velocity: velocity - 6 });
    } else if (r < 0.55) {
      // Minor triad: root + minor third + fifth (classic dark chord)
      const third = root + 3;
      const fifth = root + 7;
      if (third <= CHORD_MAX) events.push({ position: slot.position, pitch: third, duration, velocity: velocity - 8 });
      if (fifth <= CHORD_MAX) events.push({ position: slot.position, pitch: fifth, duration, velocity: velocity - 5 });
    } else if (r < 0.75) {
      // Minor 7: root + b3 + 5 + b7 (dark, jazz-influenced)
      const third = root + 3;
      const fifth = root + 7;
      const seventh = root + 10;
      if (third <= CHORD_MAX)   events.push({ position: slot.position, pitch: third,   duration, velocity: velocity - 10 });
      if (fifth <= CHORD_MAX)   events.push({ position: slot.position, pitch: fifth,   duration, velocity: velocity - 7 });
      if (seventh <= CHORD_MAX) events.push({ position: slot.position, pitch: seventh, duration, velocity: velocity - 12 });
    } else if (r < 0.88) {
      // Diminished/tension: root + b3 + b5 (maximum dark tension)
      const third = root + 3;
      const flatFive = root + 6;
      if (third <= CHORD_MAX)   events.push({ position: slot.position, pitch: third,   duration, velocity: velocity - 8 });
      if (flatFive <= CHORD_MAX) events.push({ position: slot.position, pitch: flatFive, duration, velocity: velocity - 10 });
    } else {
      // Sus4: root + 4 + 5 (atmospheric, unresolved)
      const fourth = root + 5;
      const fifth = root + 7;
      if (fourth <= CHORD_MAX) events.push({ position: slot.position, pitch: fourth, duration, velocity: velocity - 7 });
      if (fifth <= CHORD_MAX)  events.push({ position: slot.position, pitch: fifth,  duration, velocity: velocity - 5 });
    }

    // Occasional octave doubling on root for fullness
    if (rng() < 0.35) {
      const octave = root + 12;
      if (octave <= CHORD_MAX) events.push({ position: slot.position, pitch: octave, duration, velocity: velocity - 16 });
    }
  }
  return events;
}
