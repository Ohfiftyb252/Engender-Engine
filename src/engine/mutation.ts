import type { EngineState, GeneratedPack, MidiEvent, MutationNode, MutationTarget } from '../types';
import type { MutationDimension } from '../types';
import { mulberry32 } from './prng';
import { generateFingerprint } from './fingerprint';
import { computeTelemetry } from './telemetry';

const DIMENSION_SALT: Record<MutationDimension, number> = {
  groove:        0x12345678,
  velocity:      0x87654321,
  rhythm:        0xabcdef01,
  density:       0x10fedcba,
  humanization:  0xdeadbeef,
};

const MUTATION_SALT: Record<MutationTarget, number> = {
  melody: 0xaabbccdd,
  bass:   0x11223344,
  chords: 0x55667788,
  drums:  0x99aabbcc,
};

export function deriveMutationSeed(masterSeed: number, target: MutationTarget, mutationDepth: number): number {
  const salt = MUTATION_SALT[target];
  return (masterSeed ^ salt ^ (mutationDepth * 0x9e3779b9)) >>> 0;
}

/**
 * Append a mutation node. Master seed is NEVER changed.
 * Only voiceSeeds[target] is updated so other voices remain identical.
 */
export function applyMutation(state: EngineState, target: MutationTarget): EngineState {
  const newDepth = state.mutationDepth + 1;
  const voiceSeed = deriveMutationSeed(state.seed, target, newDepth);
  const nodeId = `${target}_mut_${String(newDepth).padStart(2, '0')}`;
  const node: MutationNode = { id: nodeId, target, seed: voiceSeed, depth: newDepth, parentId: state.activeNodeId };
  return {
    ...state,
    voiceSeeds: { ...state.voiceSeeds, [target]: voiceSeed },
    mutationDepth: newDepth,
    mutationPath: [...state.mutationPath, nodeId],
    mutationTree: [...state.mutationTree, node],
    activeNodeId: nodeId,
  };
}

export function deriveDimensionSeed(
  masterSeed: number,
  target: MutationTarget,
  dimension: MutationDimension,
  depth: number
): number {
  const salt = MUTATION_SALT[target] ^ DIMENSION_SALT[dimension];
  return (masterSeed ^ salt ^ (depth * 0x9e3779b9)) >>> 0;
}

export function applyDimensionMutation(
  state: EngineState,
  target: MutationTarget,
  dimension: MutationDimension
): EngineState {
  const newDepth = state.mutationDepth + 1;
  const voiceSeed = deriveDimensionSeed(state.seed, target, dimension, newDepth);
  const nodeId = `${target}_${dimension}_${String(newDepth).padStart(2, '0')}`;
  const node: MutationNode = { id: nodeId, target, seed: voiceSeed, depth: newDepth, parentId: state.activeNodeId };
  return {
    ...state,
    voiceSeeds: { ...state.voiceSeeds, [target]: voiceSeed },
    mutationDepth: newDepth,
    mutationPath: [...state.mutationPath, nodeId],
    mutationTree: [...state.mutationTree, node],
    activeNodeId: nodeId,
  };
}

/**
 * True dimension mutation — operates directly on existing events rather than
 * re-running the engine. Only the named dimension changes; all other attributes
 * of every note are preserved verbatim.
 */
export function applyDimensionMutationToPack(
  pack: GeneratedPack,
  target: MutationTarget,
  dimension: MutationDimension,
): GeneratedPack {
  const newDepth = pack.state.mutationDepth + 1;
  const seed = deriveDimensionSeed(pack.state.seed, target, dimension, newDepth);
  const rng = mulberry32(seed);

  const mutateMidi = (events: MidiEvent[]): MidiEvent[] => {
    switch (dimension) {
      case 'velocity':
        return events.map(e => ({
          ...e,
          velocity: Math.max(20, Math.min(127, e.velocity + Math.round((rng() - 0.5) * 40))),
        }));
      case 'rhythm': {
        // Shift positions within their bar; preserve pitch and velocity
        return events.map(e => {
          const bar = Math.floor(e.position / 16);
          const inBar = e.position % 16;
          const shift = Math.round((rng() - 0.5) * 4);
          const newInBar = Math.max(0, Math.min(15, Math.round(inBar) + shift));
          return { ...e, position: bar * 16 + newInBar };
        }).sort((a, b) => a.position - b.position);
      }
      case 'groove':
        return events.map(e => ({
          ...e,
          position: Math.max(0, e.position + (rng() - 0.5) * 0.5),
        }));
      case 'humanization':
        return events.map(e => ({
          ...e,
          velocity: Math.max(20, Math.min(127, e.velocity + Math.round((rng() - 0.5) * 20))),
        }));
      case 'density':
        // Thin out ~15% of notes for density reduction (deterministic per seed)
        return events.filter(() => rng() > 0.15).sort((a, b) => a.position - b.position);
      default:
        return events;
    }
  };

  let newChords = pack.chords;
  let newMelody = pack.melody;
  let newBass = pack.bass;
  // drums dimension mutations are out of scope for now (drums use DrumEvent, not MidiEvent)
  if (target === 'chords') newChords = mutateMidi(pack.chords);
  else if (target === 'melody') newMelody = mutateMidi(pack.melody);
  else if (target === 'bass') newBass = mutateMidi(pack.bass);

  const nodeId = `${target}_${dimension}_${String(newDepth).padStart(2, '0')}`;
  const node: MutationNode = { id: nodeId, target, seed, depth: newDepth, parentId: pack.state.activeNodeId };
  const newState: EngineState = {
    ...pack.state,
    voiceSeeds: { ...pack.state.voiceSeeds, [target]: seed },
    mutationDepth: newDepth,
    mutationPath: [...pack.state.mutationPath, nodeId],
    mutationTree: [...pack.state.mutationTree, node],
    activeNodeId: nodeId,
  };

  const bars = pack.state.bars ?? 4;
  const newFingerprint = generateFingerprint(newState, {
    chords: newChords, melody: newMelody, bass: newBass, drums: pack.drums.events,
  });
  const newScores = computeTelemetry(newChords, newMelody, newBass, bars);

  return {
    ...pack,
    chords: newChords,
    melody: newMelody,
    bass:   newBass,
    fingerprint: newFingerprint,
    scores: newScores,
    state:  newState,
  };
}

export function verifyMutationDeterminism(seed: number, target: MutationTarget, depth: number): boolean {
  const rng1 = mulberry32(deriveMutationSeed(seed, target, depth));
  const rng2 = mulberry32(deriveMutationSeed(seed, target, depth));
  return rng1() === rng2();
}
