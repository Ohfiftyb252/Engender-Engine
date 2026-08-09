import type { DNAProfile, GenreProfile } from '../types';
import { randInt } from './prng';

export interface GridSlot {
  position: number;
  duration: number;
  active: boolean;
}

export const TOTAL_TICKS = 64;

// Weighted position picker — strongly biases toward musical grid
function pickBeatPosition(rng: () => number, totalTicks: number, usedPositions: Set<number>): number {
  // Strong beats (beat 1 of each bar): weight 4
  // Half-beats (beat 3): weight 3
  // Quarter-beats (beat 2, 4): weight 2
  // 8th-note offbeats: weight 1.5
  // 16th-note offbeats: weight 0.5
  const weighted: number[] = [];
  for (let t = 0; t < totalTicks; t++) {
    if (usedPositions.has(t)) continue;
    const inBar = t % 16;
    let weight: number;
    if (inBar === 0)                          weight = 4;   // beat 1
    else if (inBar === 8)                     weight = 3;   // beat 3
    else if (inBar === 4 || inBar === 12)     weight = 2;   // beat 2, 4
    else if (inBar % 2 === 0)                 weight = 1.5; // 8th-note
    else                                      weight = 0.5; // 16th-note offbeat
    const count = Math.ceil(weight * 2);
    for (let i = 0; i < count; i++) weighted.push(t);
  }
  if (weighted.length === 0) return randInt(rng, 0, totalTicks - 1);
  return weighted[Math.floor(rng() * weighted.length)];
}

function buildTripletPositions(totalTicks = TOTAL_TICKS): number[] {
  const beats = totalTicks / 4;
  const positions: number[] = [];
  for (let beat = 0; beat < beats; beat++) {
    positions.push(beat * 4);
    positions.push(Math.round(beat * 4 + 4 / 3));
    positions.push(Math.round(beat * 4 + 8 / 3));
  }
  return [...new Set(positions)].filter(p => p < totalTicks);
}

export function buildRhythmGrid(rng: () => number, dna: DNAProfile, genre: GenreProfile, targetNotes: number, allowTriplets: boolean, totalTicks = TOTAL_TICKS): GridSlot[] {
  const slots: GridSlot[] = [];
  const usedPositions = new Set<number>();
  const tripletPositions = buildTripletPositions(totalTicks);
  let attempts = 0;
  const minGap = Math.max(1, Math.round(dna.rhythmGapBias * 3)); // 1–2 ticks min gap

  while (slots.filter(s => s.active).length < targetNotes && attempts < 400) {
    attempts++;
    const useTriplet = allowTriplets && rng() < genre.tripletChance * dna.tripletProbability * 2;
    let pos: number;
    if (useTriplet) {
      pos = tripletPositions[Math.floor(rng() * tripletPositions.length)];
    } else {
      pos = pickBeatPosition(rng, totalTicks, usedPositions);
    }
    if (usedPositions.has(pos)) continue;
    const tooClose = Array.from(usedPositions).some(p => Math.abs(p - pos) < minGap);
    if (tooClose) continue;
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

export function buildRollPositions(rng: () => number, density: number, bars = 4): number[] {
  const barEnds: number[] = [];
  for (let b = 2; b <= bars; b += 2) {
    barEnds.push(b * 16 - 4, b * 16 - 2);
  }
  if (bars % 2 === 1) {
    barEnds.push(bars * 16 - 4, bars * 16 - 2);
  }
  return barEnds.filter(() => rng() < density);
}
