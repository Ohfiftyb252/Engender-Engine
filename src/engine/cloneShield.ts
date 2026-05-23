import type { MidiEvent } from '../types';

export interface SimilarityReport { overall: number; rhythm: number; pitch: number; density: number; interval: number; blocked: boolean; }

const CLONE_THRESHOLD = 0.82;

export function measureSimilarity(
  a: { chords: MidiEvent[]; melody: MidiEvent[]; bass: MidiEvent[] },
  b: { chords: MidiEvent[]; melody: MidiEvent[]; bass: MidiEvent[] },
): SimilarityReport {
  const aAll = [...a.chords, ...a.melody, ...a.bass];
  const bAll = [...b.chords, ...b.melody, ...b.bass];
  const rhythm   = jaccardPositions(aAll.map(e => e.position), bAll.map(e => e.position));
  const pitch    = jaccardPitchClass(aAll.map(e => e.pitch),    bAll.map(e => e.pitch));
  const density  = densityRatio(aAll.length, bAll.length);
  const interval = intervalMatch(aAll, bAll);
  const overall  = rhythm * 0.35 + pitch * 0.3 + density * 0.15 + interval * 0.2;
  return { overall, rhythm, pitch, density, interval, blocked: overall >= CLONE_THRESHOLD };
}

function jaccardPositions(a: number[], b: number[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const sa = new Set(a); const sb = new Set(b);
  return [...sa].filter(p => sb.has(p)).length / new Set([...a, ...b]).size;
}

function jaccardPitchClass(a: number[], b: number[]): number {
  if (a.length === 0 && b.length === 0) return 1;
  const sa = new Set(a.map(p => p % 12)); const sb = new Set(b.map(p => p % 12));
  return [...sa].filter(p => sb.has(p)).length / new Set([...sa, ...sb]).size;
}

function densityRatio(nA: number, nB: number): number {
  if (nA === 0 && nB === 0) return 1;
  return Math.min(nA, nB) / Math.max(nA, nB);
}

function intervalMatch(a: MidiEvent[], b: MidiEvent[]): number {
  const getIntervals = (events: MidiEvent[]) => {
    const s = [...events].sort((x, y) => x.position - y.position);
    return s.slice(1).map((e, i) => Math.abs(e.pitch - s[i].pitch) % 12);
  };
  const ia = getIntervals(a); const ib = getIntervals(b);
  if (ia.length === 0 || ib.length === 0) return 0;
  const len = Math.min(ia.length, ib.length);
  return ia.slice(0, len).filter((v, i) => v === ib[i]).length / len;
}
