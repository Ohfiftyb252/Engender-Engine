import type { Genre, GenreProfile } from '../types';

export const GENRE_PROFILES: Record<Genre, GenreProfile> = {
  darkTrap:   { scaleBias: ['harmonicMinor', 'phrygian', 'aeolian'],          bassRollChance: 0.35, tripletChance: 0.45, melodyDensity: 3.5, chordDensity: 1.0,  velocityRange: [72, 110] },
  ukDrill:    { scaleBias: ['phrygian', 'phrygianDominant', 'harmonicMinor'], bassRollChance: 0.25, tripletChance: 0.3,  melodyDensity: 2.5, chordDensity: 0.75, velocityRange: [78, 115] },
  phonk:      { scaleBias: ['phrygianDominant', 'harmonicMinor', 'aeolian'],  bassRollChance: 0.55, tripletChance: 0.25, melodyDensity: 4.0, chordDensity: 1.25, velocityRange: [80, 120] },
  jerseyClub: { scaleBias: ['aeolian', 'phrygian', 'harmonicMinor'],          bassRollChance: 0.6,  tripletChance: 0.6,  melodyDensity: 5.0, chordDensity: 1.5,  velocityRange: [85, 125] },
};

export function getGenre(genre: Genre): GenreProfile {
  return GENRE_PROFILES[genre];
}
