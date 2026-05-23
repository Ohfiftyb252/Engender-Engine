import type { MidiEvent } from '../types';

export interface SimilarityReport {
  overall: number; // 0–1, higher = more similar
  rhythm: number;
  pitch: number;
  density: number;
  interval: number;
  blocked: boolean;
}

const CLONE_THRESHOLD = 0.82;

/** Compare two packs and return similarity report. */
export function measureSimilarity(
  a: { chords: MidiEvent[]; melody: MidiEvent[]; bass: MidiEvent[] },
  b: { chords: MidiEvent[]; melody: MidiEvent[]; bass: MidiEvent[] },
): SimilarityReport {
  const aAll = [...a.chords, ...a.melody, ...a.bass];
  const bAll = [...b.chords, ...b.melody, ...b.bass];

  const rhythm = rhythmSimilarity(
    aAll.map(e => e.position),
    bAll.map(e => e.position),
  );
  const pitch = pitchSimilarity(
    aAll.map(e => e.pitch),
    bAll.map(e => e.pitch),
  );
  const density = densitySimilarity(aAll.length, bAll.length);
  const interval = intervalSimilarity(aAll, bAll);

  const overall = rhythm * 0.35 + pitch * 0.3 + density * 0.15 + interval * 0.2;

  return { overall, rhythm, pitch, density, interval, blocked: overall >= CLONE_THRESHOLD };
}

function rhythmSimilarity(posA: number[], posB: number[]): number {
  if (posA.length === 0 && posB.length === 0) return 1;
  if (posA.length === 0 || posB.length === 0) return 0;
  const setA = new Set(posA);
  const setB = new Set(posB);
  const intersection = [...setA].filter(p => setB.has(p)).length;
  const union = new Set([...posA, ...posB]).size;
  return union === 0 ? 1 : intersection / union;
}

function pitchSimilarity(pitchesA: number[], pitchesB: number[]): number {
  if (pitchesA.length === 0 && pitchesB.length === 0) return 1;
  const setA = new Set(pitchesA.map(p => p % 12));
  const setB = new Set(pitchesB.map(p => p % 12));
  const intersection = [...setA].filter(p => setB.has(p)).length;
  const union = new Set([...setA, ...setB]).size;
  return union === 0 ? 1 : intersection / union;
}

function densitySimilarity(nA: number, nB: number): number {
  if (nA === 0 && nB === 0) return 1;
  const max = Math.max(nA, nB);
  const min = Math.min(nA, nB);
  return max === 0 ? 1 : min / max;
}

function intervalSimilarity(a: MidiEvent[], b: MidiEvent[]): number {
  const getIntervals = (events: MidiEvent[]) => {
    const sorted = [...events].sort((x, y) => x.position - y.position);
    const intervals: number[] = [];
    for (let i = 1; i < sorted.length; i++) {
      intervals.push(Math.abs(sorted[i].pitch - sorted[i - 1].pitch) % 12);
    }
    return intervals;
  };

  const ia = getIntervals(a);
  const ib = getIntervals(b);
  if (ia.length === 0 || ib.length === 0) return 0;

  const len = Math.min(ia.length, ib.length);
  let matches = 0;
  for (let i = 0; i < len; i++) {
    if (ia[i] === ib[i]) matches++;
  }
  return matches / len;
}
