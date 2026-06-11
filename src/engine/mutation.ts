import type { EngineState, MutationNode, MutationTarget } from '../types';
import { mulberry32 } from './prng';

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

export function verifyMutationDeterminism(seed: number, target: MutationTarget, depth: number): boolean {
  const rng1 = mulberry32(deriveMutationSeed(seed, target, depth));
  const rng2 = mulberry32(deriveMutationSeed(seed, target, depth));
  return rng1() === rng2();
}
