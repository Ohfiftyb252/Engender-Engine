import type { DNAProfile, GenreProfile } from '../types';
import { randInt } from './prng';

export interface GridSlot {
  position: number;
  duration: number;
  active: boolean;
}

export const TOTAL_TICKS = 64;

export function buildRhythmGrid(rng: () => number, dna: DNAProfile, genre: GenreProfile, targetNotes: number, allowTriplets: boolean): GridSlot[] {
  const slots: GridSlot[] = [];
  const usedPositions = new Set<number>();
  const tripletPositions = buildTripletPositions();
  let attempts = 0;

  while (slots.filter(s => s.active).length < targetNotes && attempts < 200) {
    attempts++;
    const useTriplet = allowTriplets && rng() < genre.tripletChance * dna.tripletProbability * 2;
    let pos: number;
    if (useTriplet) {
      pos = tripletPositions[Math.floor(rng() * tripletPositions.length)];
    } else {
      pos = randInt(rng, 0, TOTAL_TICKS - 1);
      if (rng() < 0.6) pos = Math.round(pos / 2) * 2;
    }
    if (usedPositions.has(pos)) continue;
    const tooClose = Array.from(usedPositions).some(p => Math.abs(p - pos) < (rng() < dna.rhythmGapBias ? 4 : 1));
    if (tooClose && rng() < dna.rhythmGapBias) continue;
    const rawDur = pickDuration(rng, dna);
    const duration = Math.max(1, Math.round(rawDur * dna.noteLengthModifier));
    usedPositions.add(pos);
    slots.push({ position: pos, duration, active: true });
  }
  return slots.sort((a, b) => a.position - b.position);
}

function pickDuration(rng: () => number, dna: DNAProfile): number {
  const r = rng();
  if (r < 0.4) return 1;
  if (r < 0.7) return 2;
  if (r < 0.85) return 4;
  if (r < 0.95) return 8;
  return Math.round(1 + rng() * (4 * dna.noteLengthModifier));
}

function buildTripletPositions(): number[] {
  const positions: number[] = [];
  for (let beat = 0; beat < 16; beat++) {
    positions.push(beat * 4);
    positions.push(Math.round(beat * 4 + 4 / 3));
    positions.push(Math.round(beat * 4 + 8 / 3));
  }
  return [...new Set(positions)].filter(p => p < TOTAL_TICKS);
}

export function buildRollPositions(rng: () => number, density: number): number[] {
  const barEnds = [28, 30, 60, 62];
  return barEnds.filter(() => rng() < density);
}
