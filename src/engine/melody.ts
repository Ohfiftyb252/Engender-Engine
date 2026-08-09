import type { DNAProfile, GenreProfile, MidiEvent, ScaleType } from '../types';
import { buildScalePitches, pickPitchWithBias } from './scale';
import { buildRhythmGrid } from './grid';
import { randInt } from './prng';

// Tight 1.5-octave range so the melody stays in a singable pocket
const MEL_MIN = 60; // C4
const MEL_MAX = 76; // E5

export function generateMelody(rng: () => number, dna: DNAProfile, genre: GenreProfile, key: number, scale: ScaleType, totalTicks = 64): MidiEvent[] {
  const scalePitches = buildScalePitches(key, scale, MEL_MIN, MEL_MAX);
  const allPitches: number[] = [];
  for (let p = MEL_MIN; p <= MEL_MAX; p++) allPitches.push(p);
  if (scalePitches.length === 0) return [];

  // Enough notes to make a phrase — at least 6, scale by density
  const targetNotes = Math.max(6, Math.round(genre.melodyDensity * (1 - dna.rhythmGapBias * 0.4)));
  const grid = buildRhythmGrid(rng, dna, genre, targetNotes, true, totalTicks);
  const events: MidiEvent[] = [];
  const [velMin, velMax] = genre.velocityRange;

  // Start melody in the middle of the scale for maximum movement room
  const mid = Math.floor(scalePitches.length / 2);
  let prevPitch = scalePitches[mid];
  let direction = rng() < 0.5 ? 1 : -1; // ascending or descending phrase start
  let phraseStep = 0;

  for (const slot of grid) {
    if (!slot.active) continue;
    let pitch: number;
    const r = rng();
    phraseStep++;

    if (r < dna.melodicLeapChance * 0.5) {
      // Smaller leap range (3-5 semitones max) — stays musical
      const leap = Math.floor(rng() * 4 + 2) * (rng() < 0.5 ? 1 : -1);
      const candidate = prevPitch + leap;
      pitch = snapToNearest(Math.max(MEL_MIN, Math.min(MEL_MAX, candidate)), scalePitches);
    } else if (r < dna.melodicLeapChance * 0.5 + 0.35) {
      // Step motion following phrase direction — most common in musical phrases
      const step = direction * (rng() < 0.6 ? 1 : 2);
      const idx = scalePitches.indexOf(prevPitch);
      const nextIdx = Math.max(0, Math.min(scalePitches.length - 1, idx + step));
      pitch = scalePitches[nextIdx];
      // Reverse direction at phrase boundaries or extremes
      if (phraseStep % 4 === 0 || pitch <= MEL_MIN + 1 || pitch >= MEL_MAX - 1) {
        direction *= -1;
      }
    } else if (rng() < dna.repetitionBias) {
      pitch = prevPitch; // repeat for hypnotic effect
    } else {
      // Bias toward scale center for dark, tension-building feel
      const centerBiasedPitches = [
        ...scalePitches.slice(mid - 2, mid + 3),
        ...scalePitches.slice(mid - 2, mid + 3),
        ...scalePitches,
      ].filter(Boolean);
      pitch = pickPitchWithBias(rng, centerBiasedPitches, allPitches);
    }

    prevPitch = pitch;
    // Shorter durations for melody — keep it moving
    const rawDur = Math.max(1, Math.round(slot.duration * (0.5 + rng() * 0.5)));
    const duration = Math.max(1, rawDur);
    const velocity = Math.max(50, Math.min(127, randInt(rng, velMin, velMax) + Math.round((rng() - 0.5) * dna.velocityVariance)));
    events.push({ position: slot.position, pitch, duration, velocity });
  }
  return events;
}

function snapToNearest(pitch: number, scale: number[]): number {
  if (scale.length === 0) return pitch;
  return scale.reduce((best, p) => (Math.abs(p - pitch) < Math.abs(best - pitch) ? p : best));
}
