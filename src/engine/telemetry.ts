import type { MidiEvent, TelemetryScores } from '../types';

export function computeTelemetry(chords: MidiEvent[], melody: MidiEvent[], bass: MidiEvent[], bars = 4): TelemetryScores {
  const totalTicks = bars * 16;
  return {
    bounce:      computeBounce(melody, bass, bars),
    pocket:      computePocket(chords, melody, bass, totalTicks),
    darkness:    computeDarkness(chords, melody),
    originality: computeOriginality(chords, melody, bass),
    tension:     computeTension(chords, melody),
    movement:    computeMovement(melody, bass),
    simplicity:  computeSimplicity(chords, melody, bass, bars),
  };
}

function computeBounce(melody: MidiEvent[], bass: MidiEvent[], bars: number): number {
  const all = [...melody, ...bass];
  if (all.length === 0) return 0;
  const syncopatedHits = all.filter(e => e.position % 4 !== 0).length;
  const barBuckets = new Array(bars).fill(0);
  for (const e of all) barBuckets[Math.min(bars - 1, Math.floor(e.position / 16))]++;
  const maxBar = Math.max(...barBuckets);
  const minBar = Math.min(...barBuckets);
  const variation = maxBar > 0 ? (maxBar - minBar) / maxBar : 0;
  return Math.round((syncopatedHits / all.length) * 0.65 * 100 + variation * 0.35 * 100);
}

function computePocket(chords: MidiEvent[], melody: MidiEvent[], bass: MidiEvent[], totalTicks: number): number {
  let score = 80;
  for (const m of melody) {
    score -= chords.filter(c => Math.abs(c.position - m.position) < 2 && Math.abs(c.pitch - m.pitch) < 5).length * 4;
  }
  for (const b of bass) {
    score -= chords.filter(c => Math.abs(c.position - b.position) < 2 && c.pitch - b.pitch < 6).length * 3;
  }
  const spaceRatio = Math.max(0, 1 - (chords.length + melody.length + bass.length) / totalTicks);
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

function computeOriginality(chords: MidiEvent[], melody: MidiEvent[], bass: MidiEvent[]): number {
  const all = [...chords, ...melody, ...bass];
  if (all.length === 0) return 0;

  const offBeat = all.filter(e => e.position % 4 !== 0).length;
  const rhythmicDiversity = offBeat / all.length;

  let intervalDiversity = 0;
  if (melody.length > 1) {
    const sorted = [...melody].sort((a, b) => a.position - b.position);
    const intervals = new Set<number>();
    for (let i = 1; i < sorted.length; i++) {
      intervals.add(Math.abs(sorted[i].pitch - sorted[i - 1].pitch));
    }
    intervalDiversity = Math.min(1, intervals.size / 12);
  }

  let bassIndependence = 0;
  if (bass.length > 0) {
    const chordPositions = new Set(chords.map(c => c.position));
    const independent = bass.filter(b => !chordPositions.has(b.position)).length;
    bassIndependence = independent / bass.length;
  }

  return Math.max(0, Math.min(100, Math.round(rhythmicDiversity * 40 + intervalDiversity * 35 + bassIndependence * 25)));
}

function computeTension(chords: MidiEvent[], melody: MidiEvent[]): number {
  const all = [...chords, ...melody];
  if (all.length === 0) return 0;

  const dissonantPitchClasses = new Set([1, 2, 6, 10, 11]);
  const dissonantCount = all.filter(e => dissonantPitchClasses.has(e.pitch % 12)).length;
  const dissonantRatio = dissonantCount / all.length;

  let halfStepCount = 0;
  for (const m of melody) {
    for (const c of chords) {
      if (m.position === c.position && Math.abs(m.pitch - c.pitch) % 12 === 1) {
        halfStepCount++;
      }
    }
  }
  const total = all.length;

  return Math.max(0, Math.min(100, Math.round(dissonantRatio * 70 + (halfStepCount / Math.max(1, total)) * 30)));
}

function computeMovement(melody: MidiEvent[], bass: MidiEvent[]): number {
  const all = [...melody, ...bass];
  if (all.length === 0) return 0;

  const maxPos = Math.max(...all.map(e => e.position));
  const inferredBars = Math.max(4, Math.ceil((maxPos + 1) / 16));
  const eventDensity = all.length / Math.max(1, inferredBars);

  let avgStepSize = 0;
  if (melody.length > 1) {
    const sorted = [...melody].sort((a, b) => a.position - b.position);
    let totalStep = 0;
    for (let i = 1; i < sorted.length; i++) {
      totalStep += Math.abs(sorted[i].pitch - sorted[i - 1].pitch);
    }
    avgStepSize = totalStep / (sorted.length - 1);
  }

  return Math.max(0, Math.min(100, Math.round((eventDensity / 8) * 50 + (avgStepSize / 7) * 50)));
}

function computeSimplicity(chords: MidiEvent[], melody: MidiEvent[], bass: MidiEvent[], bars: number): number {
  const all = [...chords, ...melody, ...bass];
  const totalNotes = all.length;
  const notesPerBar = bars > 0 ? totalNotes / bars : totalNotes;

  const offBeat = all.filter(e => e.position % 4 !== 0).length;
  const offBeatRatio = totalNotes > 0 ? offBeat / totalNotes : 0;

  const raw = 100 - notesPerBar * 2 - offBeatRatio * 40;
  return Math.max(0, Math.min(100, Math.round(raw)));
}
