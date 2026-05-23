import type { DNAArchetype, DNAProfile } from '../types';

export const DNA_PROFILES: Record<DNAArchetype, DNAProfile> = {
  pressure: {
    rhythmGapBias: 0.2,
    repetitionBias: 0.6,
    melodicLeapChance: 0.25,
    bassDensity: 0.85,
    noteLengthModifier: 0.8,
    tripletProbability: 0.3,
    velocityVariance: 18,
  },
  hypnotic: {
    rhythmGapBias: 0.3,
    repetitionBias: 0.85,
    melodicLeapChance: 0.1,
    bassDensity: 0.7,
    noteLengthModifier: 1.2,
    tripletProbability: 0.2,
    velocityVariance: 10,
  },
  chaotic: {
    rhythmGapBias: 0.1,
    repetitionBias: 0.15,
    melodicLeapChance: 0.6,
    bassDensity: 0.9,
    noteLengthModifier: 0.6,
    tripletProbability: 0.5,
    velocityVariance: 35,
  },
  ominous: {
    rhythmGapBias: 0.45,
    repetitionBias: 0.5,
    melodicLeapChance: 0.2,
    bassDensity: 0.6,
    noteLengthModifier: 1.5,
    tripletProbability: 0.15,
    velocityVariance: 12,
  },
  paranoid: {
    rhythmGapBias: 0.15,
    repetitionBias: 0.4,
    melodicLeapChance: 0.45,
    bassDensity: 0.8,
    noteLengthModifier: 0.7,
    tripletProbability: 0.4,
    velocityVariance: 28,
  },
  unstable: {
    rhythmGapBias: 0.05,
    repetitionBias: 0.1,
    melodicLeapChance: 0.7,
    bassDensity: 0.95,
    noteLengthModifier: 0.5,
    tripletProbability: 0.6,
    velocityVariance: 40,
  },
  cinematic: {
    rhythmGapBias: 0.5,
    repetitionBias: 0.35,
    melodicLeapChance: 0.35,
    bassDensity: 0.5,
    noteLengthModifier: 2.0,
    tripletProbability: 0.1,
    velocityVariance: 22,
  },
  emptyRoom: {
    rhythmGapBias: 0.7,
    repetitionBias: 0.3,
    melodicLeapChance: 0.15,
    bassDensity: 0.3,
    noteLengthModifier: 1.8,
    tripletProbability: 0.05,
    velocityVariance: 8,
  },
};

export function getDNA(archetype: DNAArchetype): DNAProfile {
  return DNA_PROFILES[archetype];
}
