import type { DNAProfile, GenreProfile, MidiEvent, ScaleType } from '../types';
import { buildScalePitches, pickPitchWithBias } from './scale';
import { buildRhythmGrid } from './grid';
import { randInt } from './prng';

const MEL_MIN = 60;
const MEL_MAX = 96;

export function generateMelody(rng: () => number, dna: DNAProfile, genre: GenreProfile, key: number, scale: ScaleType, totalTicks = 64): MidiEvent[] {
  const scalePitches = buildScalePitches(key, scale, MEL_MIN, MEL_MAX);
  const allPitches: number[] = [];
  for (let p = MEL_MIN; p <= MEL_MAX; p++) allPitches.push(p);
  if (scalePitches.length === 0) return [];

  const bars = totalTicks / 16;
  const targetNotes = Math.max(bars * 4, Math.round(genre.melodyDensity * bars * (1 - dna.rhythmGapBias * 0.6)));
  const grid = buildRhythmGrid(rng, dna, genre, Math.max(3, targetNotes), true, totalTicks);
  const events: MidiEvent[] = [];
  const [velMin, velMax] = genre.velocityRange;
  let prevPitch = scalePitches[Math.floor(scalePitches.length / 2)];

  for (const slot of grid) {
    if (!slot.active) continue;
    let pitch: number;
    const r = rng();

    if (r < dna.melodicLeapChance) {
      const leap = Math.floor(rng() * 8 + 5) * (rng() < 0.5 ? 1 : -1);
      pitch = Math.max(MEL_MIN, Math.min(MEL_MAX, prevPitch + leap));
      pitch = snapToNearest(pitch, scalePitches);
    } else if (r < dna.melodicLeapChance + 0.25) {
      pitch = Math.max(MEL_MIN, Math.min(MEL_MAX, prevPitch + (rng() < 0.5 ? 1 : -1)));
    } else if (rng() < dna.repetitionBias) {
      pitch = prevPitch;
    } else {
      pitch = pickPitchWithBias(rng, scalePitches, allPitches);
    }
    prevPitch = pitch;
    const duration = Math.max(1, Math.round(slot.duration * (0.4 + rng() * 0.4)));
    const velocity = Math.max(40, Math.min(127, randInt(rng, velMin, velMax) + Math.round((rng() - 0.5) * dna.velocityVariance)));
    events.push({ position: slot.position, pitch, duration, velocity });
  }
  return events;
}

function snapToNearest(pitch: number, scale: number[]): number {
  if (scale.length === 0) return pitch;
  return scale.reduce((best, p) => (Math.abs(p - pitch) < Math.abs(best - pitch) ? p : best));
}
