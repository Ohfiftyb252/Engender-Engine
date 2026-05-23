import type { EngineState, MutationNode, MutationTarget } from '../types';
import { mulberry32 } from './prng';

const MUTATION_SALT: Record<MutationTarget, number> = {
  melody: 0xaabbccdd,
  bass:   0x11223344,
  chords: 0x55667788,
};

/**
 * Derive a mutated seed for a specific target that is independent from
 * the other voice seeds. The master seed and rhythm/pocket are preserved.
 */
export function deriveMutationSeed(
  baseSeed: number,
  target: MutationTarget,
  mutationDepth: number,
): number {
  const salt = MUTATION_SALT[target];
  // Mix depth into salt so each mutation step produces a unique seed
  return (baseSeed ^ salt ^ (mutationDepth * 0x9e3779b9)) >>> 0;
}

/** Append a mutation node to the engine state and return updated state. */
export function applyMutation(
  state: EngineState,
  target: MutationTarget,
): EngineState {
  const newDepth = state.mutationDepth + 1;
  const newSeed = deriveMutationSeed(state.seed, target, newDepth);

  const nodeId = `${target}_mut_${String(newDepth).padStart(2, '0')}`;
  const node: MutationNode = {
    id: nodeId,
    target,
    seed: newSeed,
    depth: newDepth,
    parentId: state.activeNodeId,
  };

  return {
    ...state,
    seed: newSeed,
    mutationDepth: newDepth,
    mutationPath: [...state.mutationPath, nodeId],
    mutationTree: [...state.mutationTree, node],
    activeNodeId: nodeId,
  };
}

/** Verify mutation seed determinism. */
export function verifyMutationDeterminism(
  seed: number,
  target: MutationTarget,
  depth: number,
): boolean {
  const rng1 = mulberry32(deriveMutationSeed(seed, target, depth));
  const rng2 = mulberry32(deriveMutationSeed(seed, target, depth));
  return rng1() === rng2();
}
