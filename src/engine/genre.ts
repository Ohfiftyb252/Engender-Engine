import type { Genre, GenreProfile } from '../types';

export const GENRE_PROFILES: Record<Genre, GenreProfile> = {
  darkTrap:   { scaleBias: ['harmonicMinor', 'phrygian', 'aeolian'],          bassRollChance: 0.35, tripletChance: 0.45, melodyDensity: 8,  chordDensity: 4, velocityRange: [72, 110] },
  ukDrill:    { scaleBias: ['phrygian', 'phrygianDominant', 'harmonicMinor'], bassRollChance: 0.25, tripletChance: 0.3,  melodyDensity: 7,  chordDensity: 4, velocityRange: [78, 115] },
  phonk:      { scaleBias: ['phrygianDominant', 'harmonicMinor', 'aeolian'],  bassRollChance: 0.55, tripletChance: 0.25, melodyDensity: 10, chordDensity: 5, velocityRange: [80, 120] },
  jerseyClub: { scaleBias: ['aeolian', 'phrygian', 'harmonicMinor'],          bassRollChance: 0.6,  tripletChance: 0.6,  melodyDensity: 12, chordDensity: 6, velocityRange: [85, 125] },
};

export function getGenre(genre: Genre): GenreProfile {
  return GENRE_PROFILES[genre];
}
