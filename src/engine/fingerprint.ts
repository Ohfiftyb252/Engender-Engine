import type { EngineState } from '../types';

const CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function generateFingerprint(state: EngineState): string {
  const { seed, genre, dna, key, scale, bpm, mutationDepth, mutationPath } = state;
  const str = `${seed}:${genre}:${dna}:${key}:${scale}:${bpm}:${mutationDepth}:${mutationPath.join(',')}`;
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 0x01000193) >>> 0;
  }
  let out = '';
  for (let i = 0; i < 6; i++) {
    out += CHARS[h % CHARS.length];
    h = Math.imul(h ^ (h >>> 13), 0x9e3779b9) >>> 0;
  }
  return out;
}
