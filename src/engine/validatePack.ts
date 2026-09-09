import type { GeneratedPack, PackValidationResult, RepairAction } from '../types';
import { generateDrums } from './drums';
import { runEngine } from './index';

export function validatePocketPack(pack: GeneratedPack): PackValidationResult {
  const issues: string[] = [];
  const weak = new Set<'chords' | 'bass' | 'melody' | 'drums'>();
  const bars = pack.state.bars ?? 4;
  const totalTicks = bars * 16;

  // ── Note lane checks ──────────────────────────────────────────────────────
  if (pack.chords.length === 0) {
    issues.push('CHORDS EMPTY'); weak.add('chords');
  }
  if (pack.bass.length === 0) {
    issues.push('BASS EMPTY'); weak.add('bass');
  }

  // Issue 4 (updated): Too few notes — melody < 4, bass < 2
  if (pack.melody.length < 4) {
    issues.push(`MELODY TOO SPARSE (${pack.melody.length} notes)`); weak.add('melody');
  }
  if (pack.bass.length > 0 && pack.bass.length < 2) {
    issues.push('BASS TOO SPARSE'); weak.add('bass');
  }

  // ── Drum checks ───────────────────────────────────────────────────────────
  const drumEvents = pack.drums?.events ?? [];
  if (drumEvents.length === 0) {
    issues.push('DRUMS MISSING'); weak.add('drums');
  } else {
    if (!drumEvents.some(e => e.lane === 'kick'))
      { issues.push('KICK MISSING'); weak.add('drums'); }
    if (!drumEvents.some(e => e.lane === 'snare' || e.lane === 'clap'))
      { issues.push('SNARE / CLAP MISSING'); weak.add('drums'); }
    if (!drumEvents.some(e => e.lane === 'hat' || e.lane === 'openHat'))
      { issues.push('HAT MISSING'); weak.add('drums'); }
  }

  // ── Range / integrity checks ──────────────────────────────────────────────
  const allNotes = [...pack.chords, ...pack.melody, ...pack.bass];

  const outOfRange = allNotes.filter(e => e.position < 0 || e.position >= totalTicks).length;
  if (outOfRange > 0) issues.push(`${outOfRange} NOTES OUT OF 4-BAR RANGE`);

  const badDuration = allNotes.filter(e => e.duration <= 0).length;
  if (badDuration > 0) issues.push(`${badDuration} NOTES WITH INVALID DURATION`);

  const inaudible = allNotes.filter(e => e.velocity < 20).length;
  if (inaudible > 0) issues.push(`${inaudible} INAUDIBLE NOTES (vel < 20)`);

  // ── Issue 1: First-event latency ──────────────────────────────────────────
  const allSorted = [...allNotes].sort((a, b) => a.position - b.position);
  if (allSorted.length > 0 && allSorted[0].position > 4) {
    issues.push('FIRST NOTE STARTS AFTER BEAT 2');
  }

  // ── Issue 2: Empty bar ────────────────────────────────────────────────────
  // Check bars 0..N-1; a bar is empty if it has zero melodic events (chords+melody+bass)
  const melodicEvents = [...pack.chords, ...pack.melody, ...pack.bass];
  for (let bar = 0; bar < bars; bar++) {
    const barStart = bar * 16;
    const barEnd = barStart + 16;
    const barEvents = melodicEvents.filter(e => e.position >= barStart && e.position < barEnd);
    if (barEvents.length === 0) {
      issues.push(`BAR ${bar} EMPTY`);
      weak.add('melody');
    }
  }

  // ── Issue 3: Weak ending ──────────────────────────────────────────────────
  // Last bar (bar N-1) ticks range: (N-1)*16 to N*16
  const lastBarStart = (bars - 1) * 16;
  const lastBarEnd = bars * 16;
  const lastBarEvents = allNotes.filter(e => e.position >= lastBarStart && e.position < lastBarEnd);
  if (lastBarEvents.length < 2) {
    issues.push('WEAK ENDING — LAST BAR SPARSE');
  }

  // ── Issue 5: Too many notes ───────────────────────────────────────────────
  if (pack.melody.length > totalTicks / 2) {
    issues.push('MELODY OVERLOADED');
  }
  // Note: chords density is checked by Issue 8 (>60% threshold covers >100% too)

  // ── Issue 6: Bass and kick collision ──────────────────────────────────────
  // >30% of bass events share a position (within 1 tick) with kick drum events
  if (pack.bass.length > 0) {
    const kickPositions = drumEvents
      .filter(e => e.lane === 'kick')
      .map(e => e.position);
    const collisions = pack.bass.filter(bassEvent =>
      kickPositions.some(kickPos => Math.abs(bassEvent.position - kickPos) <= 1)
    );
    if (collisions.length / pack.bass.length > 0.3) {
      issues.push('BASS/KICK COLLISION (>30%)');
      weak.add('bass');
    }
  }

  // ── Issue 7: Melody too repetitive ───────────────────────────────────────
  // >60% of melody note pitches are the same pitch
  if (pack.melody.length > 0) {
    const pitchCounts = new Map<number, number>();
    for (const note of pack.melody) {
      pitchCounts.set(note.pitch, (pitchCounts.get(note.pitch) ?? 0) + 1);
    }
    const maxCount = Math.max(...pitchCounts.values());
    if (maxCount / pack.melody.length > 0.6) {
      issues.push('MELODY TOO REPETITIVE');
      weak.add('melody');
    }
  }

  // ── Issue 8: Chords too dense ─────────────────────────────────────────────
  // chords.length > totalTicks * 0.6
  if (pack.chords.length > totalTicks * 0.6) {
    issues.push('CHORDS TOO DENSE');
    weak.add('chords');
  }

  // ── Issue 9: Drum lane too empty ─────────────────────────────────────────
  // Any drum lane (kick/snare/hat) with 0 hits in any 4-bar section
  // Sections are groups of 4 bars; for a pack of N bars, check each 4-bar section
  const sectionSize = 4 * 16; // 4 bars = 64 ticks
  const numSections = Math.ceil(totalTicks / sectionSize);
  const drumLanesToCheck: Array<'kick' | 'snare' | 'hat'> = ['kick', 'snare', 'hat'];
  for (let section = 0; section < numSections; section++) {
    const secStart = section * sectionSize;
    const secEnd = Math.min(secStart + sectionSize, totalTicks);
    for (const drumLane of drumLanesToCheck) {
      const hitsInSection = drumEvents.filter(e => {
        const matchesLane = drumLane === 'snare'
          ? (e.lane === 'snare' || e.lane === 'clap')
          : drumLane === 'hat'
            ? (e.lane === 'hat' || e.lane === 'openHat')
            : e.lane === drumLane;
        return matchesLane && e.position >= secStart && e.position < secEnd;
      });
      if (hitsInSection.length === 0) {
        issues.push(`DRUM LANE ${drumLane} EMPTY IN SECTION ${section}`);
        weak.add('drums');
      }
    }
  }

  // ── Issue 10: Hi hats too robotic ────────────────────────────────────────
  // Hat events with exactly equal spacing (all gaps identical within 0.5 ticks) AND > 8 hats
  const hatEvents = drumEvents
    .filter(e => e.lane === 'hat' || e.lane === 'openHat')
    .sort((a, b) => a.position - b.position);
  if (hatEvents.length > 8) {
    const gaps: number[] = [];
    for (let i = 1; i < hatEvents.length; i++) {
      gaps.push(hatEvents[i].position - hatEvents[i - 1].position);
    }
    const firstGap = gaps[0];
    const allSameGap = gaps.every(g => Math.abs(g - firstGap) <= 0.5);
    if (allSameGap) {
      issues.push('HATS TOO ROBOTIC');
    }
  }

  // ── Issue 11: Low pocket score ────────────────────────────────────────────
  if (pack.scores.pocket < 30) {
    issues.push('LOW POCKET SCORE');
    weak.add('chords');
    weak.add('bass');
    weak.add('melody');
    weak.add('drums');
  }

  // ── Issue 12: Low bounce score ────────────────────────────────────────────
  if (pack.scores.bounce < 20) {
    issues.push('LOW BOUNCE SCORE');
    weak.add('drums');
  }

  return { valid: issues.length === 0, issues, weakLanes: [...weak] };
}

export function repairWeakLanes(pack: GeneratedPack): GeneratedPack {
  const validation = validatePocketPack(pack);
  if (validation.valid) return pack;

  const newVoiceSeeds = { ...pack.state.voiceSeeds };

  for (const lane of validation.weakLanes) {
    const current = newVoiceSeeds[lane] ?? pack.state.seed;
    // Additive advance — never reverts to a prior seed value (unlike XOR)
    newVoiceSeeds[lane] = (current + 0x9e3779b9) >>> 0;
  }

  return runEngine({ ...pack.state, voiceSeeds: newVoiceSeeds });
}

// Exported so App.tsx can call it directly for a targeted re-roll
export function repairDrumsOnly(pack: GeneratedPack): GeneratedPack {
  const currentSeed = pack.state.voiceSeeds['drums'] ?? pack.state.seed;
  const newSeed = (currentSeed + 0x9e3779b9) >>> 0;
  const newEvents = generateDrums(() => {
    let s = newSeed;
    s = (s + 0x6d2b79f5) >>> 0;
    let z = Math.imul(s ^ (s >>> 15), 1 | s);
    z = (z + Math.imul(z ^ (z >>> 7), 61 | z)) ^ z;
    return ((z ^ (z >>> 14)) >>> 0) / 4294967296;
  }, pack.state.genre, pack.state.bars ?? 4);
  return {
    ...pack,
    drums: { events: newEvents },
    state: { ...pack.state, voiceSeeds: { ...pack.state.voiceSeeds, drums: newSeed } },
  };
}

// Repair a single specific lane by XOR-shifting its seed and re-running the engine.
// The caller may record the repair via RepairAction in pack.repairActions.
export function repairLane(pack: GeneratedPack, lane: RepairAction['lane']): GeneratedPack {
  const current = pack.state.voiceSeeds[lane] ?? pack.state.seed;
  const newSeed = (current + 0x9e3779b9) >>> 0;
  const newVoiceSeeds = { ...pack.state.voiceSeeds, [lane]: newSeed };
  return runEngine({ ...pack.state, voiceSeeds: newVoiceSeeds });
}
