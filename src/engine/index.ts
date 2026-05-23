import type { EngineState, GeneratedPack, MutationTarget } from '../types';
import { createSeedBranches, mulberry32 } from './prng';
import { getDNA } from './dna';
import { getGenre } from './genre';
import { generateChords } from './chord';
import { generateMelody } from './melody';
import { generateBass } from './bass';
import { applyPocketProtection } from './pocket';
import { applyMutation } from './mutation';
import { generateFingerprint } from './fingerprint';
import { computeTelemetry } from './telemetry';
import { humanizeEvents } from './humanize';

export function runEngine(state: EngineState): GeneratedPack {
  const masterBranches = createSeedBranches(state.seed);
  const dna = getDNA(state.dna);
  const genre = getGenre(state.genre);

  const vs = state.voiceSeeds ?? {};
  const chordsRng = vs.chords != null ? mulberry32(vs.chords) : masterBranches.chords;
  const melodyRng = vs.melody != null ? mulberry32(vs.melody) : masterBranches.melody;
  const bassRng   = vs.bass   != null ? mulberry32(vs.bass)   : masterBranches.bass;

  const rawChords = generateChords(chordsRng, dna, genre, state.key, state.scale);
  const rawMelody = generateMelody(melodyRng, dna, genre, state.key, state.scale);
  const rawBass   = generateBass(bassRng, dna, genre, state.key, state.scale, rawChords);

  const { chords, melody, bass } = applyPocketProtection(rawChords, rawMelody, rawBass);

  const hChords = humanizeEvents(masterBranches.humanize, chords, dna.velocityVariance * 0.3);
  const hMelody = humanizeEvents(masterBranches.humanize, melody, dna.velocityVariance * 0.5);
  const hBass   = humanizeEvents(masterBranches.humanize, bass,   dna.velocityVariance * 0.4);

  const scores      = computeTelemetry(hChords, hMelody, hBass);
  const fingerprint = generateFingerprint(state);

  return { chords: hChords, melody: hMelody, bass: hBass, fingerprint, scores, state };
}

export function generateFresh(overrides: Partial<EngineState> = {}): GeneratedPack {
  const seed = Math.floor(Math.random() * 0xffffffff);
  const state: EngineState = {
    seed, genre: 'darkTrap', dna: 'ominous', key: 0, scale: 'harmonicMinor',
    bpm: 140, mutationDepth: 0, mutationPath: [], mutationTree: [],
    activeNodeId: null, voiceSeeds: {}, ...overrides,
  };
  return runEngine(state);
}

export function mutateVoice(currentPack: GeneratedPack, target: MutationTarget): GeneratedPack {
  return runEngine(applyMutation(currentPack.state, target));
}

export function recallFromSeed(state: EngineState): GeneratedPack {
  return runEngine(state);
}
