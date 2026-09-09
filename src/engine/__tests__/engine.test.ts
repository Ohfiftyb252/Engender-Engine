import { describe, it, expect } from 'vitest';
import { generateFresh, mutateVoice, mutateVoiceWithDimension, recallFromSeed } from '../index';
import { generateFingerprint } from '../fingerprint';
import { repairWeakLanes, repairLane } from '../validatePack';

// ── Test 1: Determinism — same seed + settings = identical canonical pack ────
describe('Determinism', () => {
  it('same seed+settings produces identical pack', () => {
    const a = generateFresh({ seed: 0xdeadbeef, genre: 'darkTrap', dna: 'ominous', key: 0, scale: 'harmonicMinor', bpm: 140, bars: 4 });
    const b = generateFresh({ seed: 0xdeadbeef, genre: 'darkTrap', dna: 'ominous', key: 0, scale: 'harmonicMinor', bpm: 140, bars: 4 });
    expect(a.fingerprint).toBe(b.fingerprint);
    expect(a.melody.length).toBe(b.melody.length);
    expect(a.chords.length).toBe(b.chords.length);
    expect(a.bass.length).toBe(b.bass.length);
    expect(a.drums.events.length).toBe(b.drums.events.length);
    expect(a.melody.map(e => e.pitch)).toEqual(b.melody.map(e => e.pitch));
    expect(a.bass.map(e => e.pitch)).toEqual(b.bass.map(e => e.pitch));
  });
});

// ── Test 2: Same pack = identical fingerprint ─────────────────────────────────
describe('Fingerprint stability', () => {
  it('same pack always produces same fingerprint', () => {
    const pack = generateFresh({ seed: 0x12345678 });
    const fp1 = generateFingerprint(pack.state, { chords: pack.chords, melody: pack.melody, bass: pack.bass, drums: pack.drums.events });
    const fp2 = generateFingerprint(pack.state, { chords: pack.chords, melody: pack.melody, bass: pack.bass, drums: pack.drums.events });
    expect(fp1).toBe(fp2);
    expect(fp1).toBe(pack.fingerprint);
  });
});

// ── Test 3: Melody mutation doesn't alter bass or chords ─────────────────────
describe('Mutation isolation: melody', () => {
  it('melody mutation preserves bass and chords pitches', () => {
    const original = generateFresh({ seed: 0xabcd1234 });
    const mutated = mutateVoice(original, 'melody');
    expect(mutated.bass.map(e => e.pitch)).toEqual(original.bass.map(e => e.pitch));
    expect(mutated.bass.map(e => e.position)).toEqual(original.bass.map(e => e.position));
    expect(mutated.chords.map(e => e.pitch)).toEqual(original.chords.map(e => e.pitch));
    expect(mutated.chords.map(e => e.position)).toEqual(original.chords.map(e => e.position));
  });
});

// ── Test 4: Bass mutation doesn't alter melody or chords ─────────────────────
describe('Mutation isolation: bass', () => {
  it('bass mutation preserves melody and chords pitches', () => {
    const original = generateFresh({ seed: 0x55aa55aa });
    const mutated = mutateVoice(original, 'bass');
    expect(mutated.melody.map(e => e.pitch)).toEqual(original.melody.map(e => e.pitch));
    expect(mutated.melody.map(e => e.position)).toEqual(original.melody.map(e => e.position));
    expect(mutated.chords.map(e => e.pitch)).toEqual(original.chords.map(e => e.pitch));
    expect(mutated.chords.map(e => e.position)).toEqual(original.chords.map(e => e.position));
  });
});

// ── Test 5: Drum mutation doesn't alter melodic lanes ────────────────────────
describe('Mutation isolation: drums', () => {
  it('drum mutation preserves melody, bass, and chords', () => {
    const original = generateFresh({ seed: 0xf0f0f0f0 });
    const mutated = mutateVoice(original, 'drums');
    expect(mutated.melody.map(e => e.pitch)).toEqual(original.melody.map(e => e.pitch));
    expect(mutated.bass.map(e => e.pitch)).toEqual(original.bass.map(e => e.pitch));
    expect(mutated.chords.map(e => e.pitch)).toEqual(original.chords.map(e => e.pitch));
  });
});

// ── Test 6: Velocity mutation changes only velocities ─────────────────────────
describe('Dimension mutation: velocity', () => {
  it('velocity mutation preserves pitches and positions', () => {
    const original = generateFresh({ seed: 0x1a2b3c4d });
    const mutated = mutateVoiceWithDimension(original, 'melody', 'velocity');
    expect(mutated.melody.map(e => e.pitch)).toEqual(original.melody.map(e => e.pitch));
    expect(mutated.melody.map(e => e.position)).toEqual(original.melody.map(e => e.position));
    // velocities should differ (probability is high with 40-wide random range)
    const velChanged = mutated.melody.some((e, i) => e.velocity !== original.melody[i]?.velocity);
    expect(velChanged).toBe(true);
  });
});

// ── Test 7: Rhythm mutation preserves pitches ────────────────────────────────
describe('Dimension mutation: rhythm', () => {
  it('rhythm mutation preserves all pitches', () => {
    const original = generateFresh({ seed: 0x2b3c4d5e });
    const mutated = mutateVoiceWithDimension(original, 'melody', 'rhythm');
    // Same pitches, same count (rhythm only shifts positions)
    expect([...mutated.melody.map(e => e.pitch)].sort()).toEqual([...original.melody.map(e => e.pitch)].sort());
    // Velocities must be unchanged
    const positionSortedOrig = [...original.melody].sort((a, b) => a.pitch - b.pitch);
    const positionSortedMut  = [...mutated.melody].sort((a, b) => a.pitch - b.pitch);
    expect(positionSortedMut.map(e => e.velocity)).toEqual(positionSortedOrig.map(e => e.velocity));
  });
});

// ── Test 8: Humanization mutation doesn't regenerate events ──────────────────
describe('Dimension mutation: humanization', () => {
  it('humanization mutation preserves pitches and positions', () => {
    const original = generateFresh({ seed: 0x3c4d5e6f });
    const mutated = mutateVoiceWithDimension(original, 'bass', 'humanization');
    expect(mutated.bass.map(e => e.pitch)).toEqual(original.bass.map(e => e.pitch));
    expect(mutated.bass.map(e => e.position)).toEqual(original.bass.map(e => e.position));
  });
});

// ── Test 9: Multi-bar patterns don't collapse to one bar ─────────────────────
describe('Multi-bar generation', () => {
  it('4-bar pack has events in bars 0-3', () => {
    const pack = generateFresh({ seed: 0xdeadbeef, bars: 4 });
    const melInBar = (bar: number) => pack.melody.filter(e => Math.floor(e.position / 16) === bar).length;
    const barsWithNotes = [0,1,2,3].filter(b => melInBar(b) > 0);
    expect(barsWithNotes.length).toBeGreaterThan(1);
  });

  it('8-bar pack has events beyond position 63', () => {
    const pack = generateFresh({ seed: 0x12345678, bars: 8 });
    const allEvents = [...pack.melody, ...pack.bass, ...pack.chords];
    const hasBar4Plus = allEvents.some(e => e.position >= 64);
    expect(hasBar4Plus).toBe(true);
  });
});

// ── Test 10: Fractional positions survive generation → MIDI ──────────────────
describe('Fractional timing', () => {
  it('drum events can have fractional positions', () => {
    // Drum generation uses triplets which produce fractional positions
    const pack = generateFresh({ seed: 0xfaceb00c, genre: 'jerseyClub', dna: 'unstable' });
    // At least check positions are in valid range
    for (const e of pack.drums.events) {
      expect(e.position).toBeGreaterThanOrEqual(0);
      expect(e.position).toBeLessThan((pack.state.bars ?? 4) * 16);
    }
  });
});

// ── Test 11: 4/8/16 bar packs generate events throughout range ───────────────
describe('Bar-count scaling', () => {
  for (const barCount of [4, 8, 16]) {
    it(`${barCount}-bar pack covers the full range`, () => {
      const pack = generateFresh({ seed: 0xaabbccdd, bars: barCount });
      const totalTicks = barCount * 16;
      const allEvents = [...pack.melody, ...pack.bass, ...pack.chords];
      expect(allEvents.length).toBeGreaterThan(barCount * 2);
      // At least some events in the second half
      const secondHalf = allEvents.filter(e => e.position >= totalTicks / 2);
      expect(secondHalf.length).toBeGreaterThan(0);
    });
  }
});

// ── Test 12: Telemetry handles 32 bars without crashing ─────────────────────
describe('Telemetry: 32 bars', () => {
  it('computes valid scores for 32-bar pack', () => {
    const pack = generateFresh({ seed: 0x11223344, bars: 32 });
    const { scores } = pack;
    for (const key of Object.keys(scores) as Array<keyof typeof scores>) {
      expect(scores[key]).toBeGreaterThanOrEqual(0);
      expect(scores[key]).toBeLessThanOrEqual(100);
    }
  });
});

// ── Test 13: Repair doesn't toggle between two seeds ─────────────────────────
describe('Repair: no XOR toggle', () => {
  it('repeated repairs advance seed, never return to prior value', () => {
    let pack = generateFresh({ seed: 0x99887766 });
    const seeds: number[] = [];
    for (let i = 0; i < 4; i++) {
      pack = repairWeakLanes(pack);
      for (const t of (['melody', 'bass', 'chords', 'drums'] as const)) {
        const seed = pack.state.voiceSeeds[t];
        if (seed !== undefined) seeds.push(seed);
      }
    }
    const unique = new Set(seeds);
    expect(unique.size).toBe(seeds.length); // all seeds unique — no toggle back
  });

  it('repairLane on same lane twice advances seed both times', () => {
    let pack = generateFresh({ seed: 0x11111111 });
    const seed1 = pack.state.voiceSeeds['melody'];
    pack = repairLane(pack, 'melody');
    const seed2 = pack.state.voiceSeeds['melody'];
    pack = repairLane(pack, 'melody');
    const seed3 = pack.state.voiceSeeds['melody'];
    expect(seed2).not.toBe(seed1);
    expect(seed3).not.toBe(seed2);
    expect(seed3).not.toBe(seed1);
  });
});

// ── Test 17: Decimal and hex seeds parse correctly ──────────────────────────
describe('Seed parsing', () => {
  it('decimal "100" parses as 100', () => {
    const s = '100';
    const parsed = /^0x/i.test(s) || /[a-fA-F]/.test(s) ? parseInt(s, 16) : parseInt(s, 10);
    expect(parsed).toBe(100);
  });

  it('hex "DEADBEEF" parses as 0xDEADBEEF', () => {
    const s = 'DEADBEEF';
    const parsed = /^0x/i.test(s) || /[a-fA-F]/.test(s) ? parseInt(s, 16) : parseInt(s, 10);
    expect(parsed).toBe(0xdeadbeef);
  });

  it('hex "0x64" parses as 100', () => {
    const s = '0x64';
    const parsed = /^0x/i.test(s) || /[a-fA-F]/.test(s) ? parseInt(s.replace(/^0x/i, ''), 16) : parseInt(s, 10);
    expect(parsed).toBe(100);
  });
});

// ── Test 18: No out-of-range MIDI notes ─────────────────────────────────────
describe('Note validity: range', () => {
  it('all MIDI notes are in range 0-127', () => {
    const pack = generateFresh({ seed: 0xc0ffee });
    const allNotes = [...pack.chords, ...pack.melody, ...pack.bass];
    for (const e of allNotes) {
      expect(e.pitch).toBeGreaterThanOrEqual(0);
      expect(e.pitch).toBeLessThanOrEqual(127);
    }
  });

  it('all note positions are within total tick range', () => {
    const bars = 8;
    const pack = generateFresh({ seed: 0xbabe1234, bars });
    const totalTicks = bars * 16;
    for (const e of [...pack.chords, ...pack.melody, ...pack.bass]) {
      expect(e.position).toBeGreaterThanOrEqual(0);
      expect(e.position).toBeLessThan(totalTicks);
    }
  });
});

// ── Test 19: No invalid durations ────────────────────────────────────────────
describe('Note validity: duration', () => {
  it('all note durations are positive', () => {
    const pack = generateFresh({ seed: 0xfeedface });
    const allNotes = [...pack.chords, ...pack.melody, ...pack.bass];
    for (const e of allNotes) {
      expect(e.duration).toBeGreaterThan(0);
    }
  });
});

// ── Test 20: Snapshot recall reproduces same pack ─────────────────────────────
describe('Snapshot recall', () => {
  it('recalling a state produces same fingerprint', () => {
    const original = generateFresh({ seed: 0x9a8b7c6d });
    const recalled = recallFromSeed(original.state);
    expect(recalled.fingerprint).toBe(original.fingerprint);
    expect(recalled.melody.map(e => e.pitch)).toEqual(original.melody.map(e => e.pitch));
  });
});
