import type { MidiEvent, TelemetryScores } from '../types';
import { TOTAL_TICKS } from './grid';

/** Compute Bounce, Pocket, and Darkness telemetry scores. */
export function computeTelemetry(
  chords: MidiEvent[],
  melody: MidiEvent[],
  bass: MidiEvent[],
): TelemetryScores {
  return {
    bounce:   computeBounce(melody, bass),
    pocket:   computePocket(chords, melody, bass),
    darkness: computeDarkness(chords, melody),
  };
}

/**
 * Bounce: measures rhythmic energy — syncopation + density variation.
 * High bounce = lots of offbeat hits and rhythm variation.
 */
function computeBounce(melody: MidiEvent[], bass: MidiEvent[]): number {
  const all = [...melody, ...bass];
  if (all.length === 0) return 0;

  let syncopatedHits = 0;
  let totalHits = all.length;

  for (const e of all) {
    // Offbeat = not on a beat (every 4 ticks)
    const beatPhase = e.position % 4;
    if (beatPhase !== 0) syncopatedHits++;
  }

  const syncopationRatio = syncopatedHits / totalHits;

  // Density variation across bars
  const bars = [0, 0, 0, 0];
  for (const e of all) bars[Math.min(3, Math.floor(e.position / 16))]++;
  const maxBar = Math.max(...bars);
  const minBar = Math.min(...bars);
  const variation = maxBar > 0 ? (maxBar - minBar) / maxBar : 0;

  return Math.round((syncopationRatio * 0.65 + variation * 0.35) * 100);
}

/**
 * Pocket: measures how well the notes sit in the frequency register zones.
 * Penalizes register collisions between voices.
 */
function computePocket(
  chords: MidiEvent[],
  melody: MidiEvent[],
  bass: MidiEvent[],
): number {
  let score = 80;

  // Check melody stays above chord range
  for (const m of melody) {
    const chordCollisions = chords.filter(
      c => Math.abs(c.position - m.position) < 2 && Math.abs(c.pitch - m.pitch) < 5,
    );
    score -= chordCollisions.length * 4;
  }

  // Check bass stays below chord range
  for (const b of bass) {
    const chordCollisions = chords.filter(
      c => Math.abs(c.position - b.position) < 2 && c.pitch - b.pitch < 6,
    );
    score -= chordCollisions.length * 3;
  }

  // Space ratio bonus — rests improve pocket
  const totalNotes = chords.length + melody.length + bass.length;
  const spaceRatio = Math.max(0, 1 - totalNotes / TOTAL_TICKS);
  score += Math.round(spaceRatio * 20);

  return Math.max(0, Math.min(100, score));
}

/**
 * Darkness: measures scale and interval tension.
 * High darkness = lots of minor 2nds, flat-2nds, tritones.
 */
function computeDarkness(
  chords: MidiEvent[],
  melody: MidiEvent[],
): number {
  const all = [...chords, ...melody];
  if (all.length === 0) return 50;

  let tensionScore = 0;
  let total = 0;

  for (const e of all) {
    const interval = e.pitch % 12;
    // Dark intervals: b2, b3, b6, b7, tritone
    const darkIntervals = [1, 3, 6, 8, 10, 11];
    if (darkIntervals.includes(interval)) tensionScore += 2;
    else tensionScore += 1;
    total++;
  }

  // Low register = more darkness
  const avgPitch = all.reduce((s, e) => s + e.pitch, 0) / all.length;
  const registerBonus = Math.max(0, (72 - avgPitch) / 72) * 30;

  const base = total > 0 ? (tensionScore / (total * 2)) * 70 : 50;
  return Math.round(Math.min(100, base + registerBonus));
}
