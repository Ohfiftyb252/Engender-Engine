import type { DrumEvent, EngineState, MidiEvent } from '../types';

export const ENGINE_VERSION = '1.0.0';
export const RENDER_VERSION = '1.0.0';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export interface FingerprintEvents {
  chords: MidiEvent[];
  melody: MidiEvent[];
  bass: MidiEvent[];
  drums: DrumEvent[];
}

export function generateFingerprint(state: EngineState, events?: FingerprintEvents): string {
  const { seed, genre, dna, key, scale, bpm, bars, mutationDepth, mutationPath } = state;
  const str = `${seed}:${genre}:${dna}:${key}:${scale}:${bpm}:${bars ?? 4}:${mutationDepth}:${mutationPath.join(',')}:${ENGINE_VERSION}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  // Mix in note-event content so fingerprint reflects actual generated notes
  if (events) {
    for (const e of [...events.chords, ...events.melody, ...events.bass]) {
      h ^= (Math.round(e.position) * 127 + e.pitch) & 0xffffff;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
    for (const e of events.drums) {
      h ^= (Math.round(e.position * 2) * 47 + e.pitch) & 0xffffff;
      h = Math.imul(h, 0x01000193) >>> 0;
    }
  }
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += CHARS[h % CHARS.length];
    h = Math.imul(h ^ (h >>> 13), 0x9e3779b9) >>> 0;
  }
  return out;
}
