import type { DNAProfile, GenreProfile } from '../types';
import { randInt } from './prng';

export interface GridSlot {
  /** Position in 16th-note ticks (0–63 for 4 bars). */
  position: number;
  /** Duration in 16th-note ticks. */
  duration: number;
  active: boolean;
}

/** Total 16th-note ticks for 4 bars (16 steps × 4 bars). */
export const TOTAL_TICKS = 64;

/**
 * Build a rhythm grid for one voice.
 * Returns an array of GridSlots sorted by position.
 */
export function buildRhythmGrid(
  rng: () => number,
  dna: DNAProfile,
  genre: GenreProfile,
  targetNotes: number,
  allowTriplets: boolean,
): GridSlot[] {
  const slots: GridSlot[] = [];
  const usedPositions = new Set<number>();

  const tripletPositions = buildTripletPositions();

  let attempts = 0;
  while (slots.filter(s => s.active).length < targetNotes && attempts < 200) {
    attempts++;

    // Decide if this note lands on a triplet grid
    const useTriplet = allowTriplets && rng() < genre.tripletChance * dna.tripletProbability * 2;
    let pos: number;

    if (useTriplet) {
      pos = tripletPositions[Math.floor(rng() * tripletPositions.length)];
    } else {
      // 16th-note grid with gap bias
      pos = randInt(rng, 0, TOTAL_TICKS - 1);
      // Snap to 8th note grid with rhythm gap bias
      if (rng() < 0.6) pos = Math.round(pos / 2) * 2;
    }

    if (usedPositions.has(pos)) continue;

    // Apply gap bias — skip if too close to previous note
    const tooClose = Array.from(usedPositions).some(
      p => Math.abs(p - pos) < (rng() < dna.rhythmGapBias ? 4 : 1),
    );
    if (tooClose && rng() < dna.rhythmGapBias) continue;

    const rawDur = pickDuration(rng, dna);
    const duration = Math.max(1, Math.round(rawDur * dna.noteLengthModifier));

    usedPositions.add(pos);
    slots.push({ position: pos, duration, active: true });
  }

  return slots.sort((a, b) => a.position - b.position);
}

/** Duration choices in 16th-note ticks. */
function pickDuration(rng: () => number, dna: DNAProfile): number {
  const r = rng();
  if (r < 0.4) return 1;          // 16th
  if (r < 0.7) return 2;          // 8th
  if (r < 0.85) return 4;         // quarter
  if (r < 0.95) return 8;         // half
  return Math.round(1 + rng() * (4 * dna.noteLengthModifier)); // random
}

/**
 * Triplet-8th positions within 4 bars.
 * 4 bars × 4 beats × 3 triplet-8ths = 48 positions.
 * Mapped onto 16th-note grid (×4/3 per triplet slot).
 */
function buildTripletPositions(): number[] {
  const positions: number[] = [];
  for (let beat = 0; beat < 16; beat++) {
    // Each beat = 4 ticks. Triplet 8ths sit at ×0, ×4/3, ×8/3 within beat.
    positions.push(beat * 4);
    positions.push(Math.round(beat * 4 + 4 / 3));
    positions.push(Math.round(beat * 4 + 8 / 3));
  }
  return [...new Set(positions)].filter(p => p < TOTAL_TICKS);
}

/** Build 4 bars of bar-end roll positions (bar 2 and bar 4 endings). */
export function buildRollPositions(rng: () => number, density: number): number[] {
  const barEnds = [28, 30, 60, 62]; // near tick 32 and 64 ends
  return barEnds.filter(() => rng() < density);
}
