import type { DNAProfile, GenreProfile, MidiEvent, ScaleType } from '../types';
import { buildScalePitches } from './scale';
import { buildRhythmGrid, buildRollPositions } from './grid';
import { randInt, randPick } from './prng';

const BASS_MIN = 24;
const BASS_MAX = 42;

export function generateBass(rng: () => number, dna: DNAProfile, genre: GenreProfile, key: number, scale: ScaleType, chordEvents: MidiEvent[], totalTicks = 64, bars = 4): MidiEvent[] {
  const scalePitches = buildScalePitches(key, scale, BASS_MIN, BASS_MAX);
  if (scalePitches.length === 0) return [];

  const targetNotes = Math.round(8 * dna.bassDensity * (1 - dna.rhythmGapBias * 0.3));
  const grid = buildRhythmGrid(rng, dna, genre, Math.max(4, targetNotes), genre.bassRollChance > 0.4, totalTicks);
  const [velMin, velMax] = genre.velocityRange;
  const barStarts = Array.from({ length: bars }, (_, i) => i * 16);
  const chordAtBar = getChordRootsAtBeats(chordEvents, barStarts, key);
  const events: MidiEvent[] = [];

  for (const slot of grid) {
    if (!slot.active) continue;
    let pitch: number;
    const nearBarStart = barStarts.find(b => Math.abs(slot.position - b) <= 1);
    if (nearBarStart !== undefined && chordAtBar[nearBarStart] !== undefined) {
      pitch = chordAtBar[nearBarStart]!;
    } else {
      const rootPitches = scalePitches.filter(p => (p - key + 12) % 12 === 0);
      pitch = rootPitches.length > 0 && rng() < 0.55 ? randPick(rng, rootPitches) : randPick(rng, scalePitches);
    }
    const velocity = Math.max(50, Math.min(127, randInt(rng, velMin + 5, velMax) + Math.round((rng() - 0.5) * dna.velocityVariance)));
    const duration = Math.max(2, Math.round(slot.duration * (1.0 + rng() * 1.5)));
    events.push({ position: slot.position, pitch, duration, velocity });
  }

  const rollPositions = buildRollPositions(rng, genre.bassRollChance * dna.bassDensity, bars);
  for (const rollPos of rollPositions) {
    const rollLen = randInt(rng, 2, 4);
    const rootPitches = scalePitches.filter(p => (p - key + 12) % 12 === 0);
    const rollRoot = rootPitches.length > 0 ? randPick(rng, rootPitches) : randPick(rng, scalePitches);
    for (let i = 0; i < rollLen; i++) {
      const pos = rollPos + i;
      if (pos >= totalTicks) break;
      events.push({ position: pos, pitch: rollRoot, duration: 1, velocity: Math.max(50, Math.min(127, randInt(rng, velMin, velMax - 10 + i * 3))) });
    }
  }
  return events.sort((a, b) => a.position - b.position);
}

function getChordRootsAtBeats(chords: MidiEvent[], beats: number[], key: number): Record<number, number> {
  const result: Record<number, number> = {};
  for (const beat of beats) {
    const nearby = chords
      .filter(e => Math.abs(e.position - beat) <= 2)
      .sort((a, b) => Math.abs(a.position - beat) - Math.abs(b.position - beat));
    if (nearby.length > 0) {
      const lowestChordNote = nearby.reduce((low, e) => (e.pitch < low.pitch ? e : low)).pitch;
      const bassPitch = key + 24 + (((lowestChordNote - key) % 12) + 12) % 12;
      result[beat] = Math.min(42, bassPitch);
    }
  }
  return result;
}
