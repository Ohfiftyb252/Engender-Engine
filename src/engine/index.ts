import type { EngineState, GeneratedPack, MutationTarget } from '../types';
import { createSeedBranches } from './prng';
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

/** Run the full ENGENDER ENGINE pipeline and return a generated pack. */
export function runEngine(state: EngineState): GeneratedPack {
  const rng = createSeedBranches(state.seed);
  const dna = getDNA(state.dna);
  const genre = getGenre(state.genre);

  // 1. Rhythm grids are generated inside each voice engine using their branch RNG
  // 2. Chord engine
  const rawChords = generateChords(rng.chords, dna, genre, state.key, state.scale);

  // 3. Melody engine (independent branch)
  const rawMelody = generateMelody(rng.melody, dna, genre, state.key, state.scale);

  // 4. Bass/808 engine (chord-aware for root lock)
  const rawBass = generateBass(rng.bass, dna, genre, state.key, state.scale, rawChords);

  // 5. Pocket protection
  const { chords, melody, bass } = applyPocketProtection(rawChords, rawMelody, rawBass);

  // 6. Humanization
  const hChords = humanizeEvents(rng.humanize, chords, dna.velocityVariance * 0.3);
  const hMelody = humanizeEvents(rng.humanize, melody, dna.velocityVariance * 0.5);
  const hBass   = humanizeEvents(rng.humanize, bass,   dna.velocityVariance * 0.4);

  // 7. Telemetry
  const scores = computeTelemetry(hChords, hMelody, hBass);

  // 8. Fingerprint
  const fingerprint = generateFingerprint(state);

  return {
    chords: hChords,
    melody: hMelody,
    bass:   hBass,
    fingerprint,
    scores,
    state,
  };
}

/** Generate a fresh pack with a random seed. */
export function generateFresh(overrides: Partial<EngineState> = {}): GeneratedPack {
  const seed = Math.floor(Math.random() * 0xffffffff);
  const state: EngineState = {
    seed,
    genre: 'darkTrap',
    dna: 'ominous',
    key: 0,
    scale: 'harmonicMinor',
    bpm: 140,
    mutationDepth: 0,
    mutationPath: [],
    mutationTree: [],
    activeNodeId: null,
    ...overrides,
  };
  return runEngine(state);
}

/** Mutate a single voice while preserving all others. */
export function mutateVoice(
  currentPack: GeneratedPack,
  target: MutationTarget,
): GeneratedPack {
  const newState = applyMutation(currentPack.state, target);
  return runEngine(newState);
}

/** Regenerate a pack from a saved seed (snapshot recall). */
export function recallFromSeed(state: EngineState): GeneratedPack {
  return runEngine(state);
}
