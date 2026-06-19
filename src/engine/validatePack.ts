import type { GeneratedPack, PackValidationResult } from '../types';
import { generateDrums } from './drums';
import { runEngine } from './index';

export function validatePocketPack(pack: GeneratedPack): PackValidationResult {
  const issues: string[] = [];
  const weak = new Set<'chords' | 'bass' | 'melody' | 'drums'>();
  const totalTicks = (pack.state.bars ?? 4) * 16;

  // ── Note lane checks ──────────────────────────────────────────────────────
  if (pack.chords.length === 0) {
    issues.push('CHORDS EMPTY'); weak.add('chords');
  }
  if (pack.bass.length === 0) {
    issues.push('BASS EMPTY'); weak.add('bass');
  }
  if (pack.melody.length < 3) {
    issues.push(`MELODY TOO SPARSE (${pack.melody.length} notes)`); weak.add('melody');
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

  // ── First-event latency ───────────────────────────────────────────────────
  const allSorted = [...allNotes].sort((a, b) => a.position - b.position);
  if (allSorted.length > 0 && allSorted[0].position > 4) {
    issues.push('FIRST NOTE STARTS AFTER BEAT 2');
  }

  return { valid: issues.length === 0, issues, weakLanes: [...weak] };
}

export function repairWeakLanes(pack: GeneratedPack): GeneratedPack {
  const validation = validatePocketPack(pack);
  if (validation.valid) return pack;

  const newVoiceSeeds = { ...pack.state.voiceSeeds };

  for (const lane of validation.weakLanes) {
    const current = newVoiceSeeds[lane] ?? pack.state.seed;
    // XOR-shift the seed so a fresh pattern is generated for this lane
    newVoiceSeeds[lane] = (current ^ 0x6c62272e ^ (validation.weakLanes.length * 0x9e3779b9)) >>> 0;
  }

  return runEngine({ ...pack.state, voiceSeeds: newVoiceSeeds });
}

// Exported so App.tsx can call it directly for a targeted re-roll
export function repairDrumsOnly(pack: GeneratedPack): GeneratedPack {
  const currentSeed = pack.state.voiceSeeds['drums'] ?? pack.state.seed;
  const newSeed = (currentSeed ^ 0xdeadbeef) >>> 0;
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
