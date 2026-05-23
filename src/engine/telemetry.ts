import type { MidiEvent, TelemetryScores } from '../types';
import { TOTAL_TICKS } from './grid';

export function computeTelemetry(chords: MidiEvent[], melody: MidiEvent[], bass: MidiEvent[]): TelemetryScores {
  return { bounce: computeBounce(melody, bass), pocket: computePocket(chords, melody, bass), darkness: computeDarkness(chords, melody) };
}

function computeBounce(melody: MidiEvent[], bass: MidiEvent[]): number {
  const all = [...melody, ...bass];
  if (all.length === 0) return 0;
  const syncopatedHits = all.filter(e => e.position % 4 !== 0).length;
  const bars = [0, 0, 0, 0];
  for (const e of all) bars[Math.min(3, Math.floor(e.position / 16))]++;
  const maxBar = Math.max(...bars);
  const minBar = Math.min(...bars);
  const variation = maxBar > 0 ? (maxBar - minBar) / maxBar : 0;
  return Math.round((syncopatedHits / all.length) * 0.65 * 100 + variation * 0.35 * 100);
}

function computePocket(chords: MidiEvent[], melody: MidiEvent[], bass: MidiEvent[]): number {
  let score = 80;
  for (const m of melody) {
    score -= chords.filter(c => Math.abs(c.position - m.position) < 2 && Math.abs(c.pitch - m.pitch) < 5).length * 4;
  }
  for (const b of bass) {
    score -= chords.filter(c => Math.abs(c.position - b.position) < 2 && c.pitch - b.pitch < 6).length * 3;
  }
  const spaceRatio = Math.max(0, 1 - (chords.length + melody.length + bass.length) / TOTAL_TICKS);
  return Math.max(0, Math.min(100, score + Math.round(spaceRatio * 20)));
}

function computeDarkness(chords: MidiEvent[], melody: MidiEvent[]): number {
  const all = [...chords, ...melody];
  if (all.length === 0) return 50;
  let tensionScore = 0;
  for (const e of all) {
    tensionScore += [1, 3, 6, 8, 10, 11].includes(e.pitch % 12) ? 2 : 1;
  }
  const avgPitch = all.reduce((s, e) => s + e.pitch, 0) / all.length;
  const registerBonus = Math.max(0, (72 - avgPitch) / 72) * 30;
  return Math.round(Math.min(100, (tensionScore / (all.length * 2)) * 70 + registerBonus));
}
