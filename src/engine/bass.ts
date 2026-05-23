import type { DNAProfile, GenreProfile, MidiEvent } from '../types';
import type { ScaleType } from '../types';
import { buildScalePitches } from './scale';
import { buildRhythmGrid, buildRollPositions, TOTAL_TICKS } from './grid';
import { randInt, randPick } from './prng';

/** 808 pocket: MIDI 24–42 */
const BASS_MIN = 24;
const BASS_MAX = 42;

export function generateBass(
  rng: () => number,
  dna: DNAProfile,
  genre: GenreProfile,
  key: number,
  scale: ScaleType,
  chordEvents: MidiEvent[],
): MidiEvent[] {
  const scalePitches = buildScalePitches(key, scale, BASS_MIN, BASS_MAX);
  if (scalePitches.length === 0) return [];

  const targetNotes = Math.round(8 * dna.bassDensity * (1 - dna.rhythmGapBias * 0.3));
  const grid = buildRhythmGrid(rng, dna, genre, Math.max(4, targetNotes), genre.bassRollChance > 0.4);
  const [velMin, velMax] = genre.velocityRange;

  const events: MidiEvent[] = [];

  // Beat 1 of each bar root-locks to chord root
  const barStarts = [0, 16, 32, 48];
  const chordAtBar = getChordRootsAtBeats(chordEvents, barStarts, key);

  for (const slot of grid) {
    if (!slot.active) continue;

    let pitch: number;

    // Check if this slot is near a bar-start (within 2 ticks) — root-lock
    const nearBarStart = barStarts.find(b => Math.abs(slot.position - b) <= 1);
    if (nearBarStart !== undefined && chordAtBar[nearBarStart] !== undefined) {
      pitch = chordAtBar[nearBarStart]!;
    } else {
      // Follow scale with root bias
      const rootPitches = scalePitches.filter(p => (p - key + 12) % 12 === 0);
      if (rootPitches.length > 0 && rng() < 0.55) {
        pitch = randPick(rng, rootPitches);
      } else {
        pitch = randPick(rng, scalePitches);
      }
    }

    const velocity = Math.max(
      50,
      Math.min(127, randInt(rng, velMin + 5, velMax) + Math.round((rng() - 0.5) * dna.velocityVariance)),
    );
    // Bass notes ring: 2–8 ticks
    const duration = Math.max(2, Math.round(slot.duration * (1.0 + rng() * 1.5)));

    events.push({ position: slot.position, pitch, duration, velocity });
  }

  // Bass rolls at bar endings
  const rollPositions = buildRollPositions(rng, genre.bassRollChance * dna.bassDensity);
  for (const rollPos of rollPositions) {
    const rollLen = randInt(rng, 2, 4);
    const rootPitches = scalePitches.filter(p => (p - key + 12) % 12 === 0);
    const rollRoot = rootPitches.length > 0 ? randPick(rng, rootPitches) : randPick(rng, scalePitches);
    for (let i = 0; i < rollLen; i++) {
      const pos = rollPos + i;
      if (pos >= TOTAL_TICKS) break;
      const v = Math.max(50, Math.min(127, randInt(rng, velMin, velMax - 10 + i * 3)));
      events.push({ position: pos, pitch: rollRoot, duration: 1, velocity: v });
    }
  }

  return events.sort((a, b) => a.position - b.position);
}

function getChordRootsAtBeats(
  chords: MidiEvent[],
  beats: number[],
  key: number,
): Record<number, number> {
  const result: Record<number, number> = {};
  for (const beat of beats) {
    const nearby = chords
      .filter(e => Math.abs(e.position - beat) <= 2)
      .sort((a, b) => Math.abs(a.position - beat) - Math.abs(b.position - beat));
    if (nearby.length > 0) {
      // Find the lowest pitch in this chord cluster (the root)
      const lowestChordNote = nearby.reduce((low, e) => (e.pitch < low.pitch ? e : low)).pitch;
      // Transpose to bass register
      const bassPitch = key + 24 + (((lowestChordNote - key) % 12) + 12) % 12;
      result[beat] = Math.min(42, bassPitch);
    }
  }
  return result;
}
