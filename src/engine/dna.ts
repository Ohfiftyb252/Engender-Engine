import type { DNAArchetype, DNAProfile } from '../types';

export const DNA_PROFILES: Record<DNAArchetype, DNAProfile> = {
  pressure:  { rhythmGapBias: 0.15, repetitionBias: 0.6,  melodicLeapChance: 0.2,  bassDensity: 0.9,  noteLengthModifier: 0.8,  tripletProbability: 0.3,  velocityVariance: 18 },
  hypnotic:  { rhythmGapBias: 0.2,  repetitionBias: 0.85, melodicLeapChance: 0.08, bassDensity: 0.75, noteLengthModifier: 1.2,  tripletProbability: 0.2,  velocityVariance: 10 },
  chaotic:   { rhythmGapBias: 0.1,  repetitionBias: 0.15, melodicLeapChance: 0.4,  bassDensity: 0.9,  noteLengthModifier: 0.6,  tripletProbability: 0.5,  velocityVariance: 30 },
  ominous:   { rhythmGapBias: 0.3,  repetitionBias: 0.55, melodicLeapChance: 0.15, bassDensity: 0.65, noteLengthModifier: 1.4,  tripletProbability: 0.15, velocityVariance: 12 },
  paranoid:  { rhythmGapBias: 0.12, repetitionBias: 0.4,  melodicLeapChance: 0.35, bassDensity: 0.85, noteLengthModifier: 0.7,  tripletProbability: 0.4,  velocityVariance: 25 },
  unstable:  { rhythmGapBias: 0.08, repetitionBias: 0.1,  melodicLeapChance: 0.5,  bassDensity: 0.95, noteLengthModifier: 0.55, tripletProbability: 0.55, velocityVariance: 35 },
  cinematic: { rhythmGapBias: 0.35, repetitionBias: 0.4,  melodicLeapChance: 0.25, bassDensity: 0.55, noteLengthModifier: 1.8,  tripletProbability: 0.1,  velocityVariance: 20 },
  emptyRoom: { rhythmGapBias: 0.45, repetitionBias: 0.35, melodicLeapChance: 0.12, bassDensity: 0.45, noteLengthModifier: 1.6,  tripletProbability: 0.08, velocityVariance: 10 },
};

export function getDNA(archetype: DNAArchetype): DNAProfile {
  return DNA_PROFILES[archetype];
}
