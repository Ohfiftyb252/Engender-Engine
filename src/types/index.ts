export type Genre = 'darkTrap' | 'ukDrill' | 'phonk' | 'jerseyClub';

export type DNAArchetype =
  | 'pressure'
  | 'hypnotic'
  | 'chaotic'
  | 'ominous'
  | 'paranoid'
  | 'unstable'
  | 'cinematic'
  | 'emptyRoom';

export type ScaleType =
  | 'harmonicMinor'
  | 'phrygian'
  | 'phrygianDominant'
  | 'aeolian';

export type MutationTarget = 'melody' | 'bass' | 'chords';

export interface MidiEvent {
  /** Position in 16th-note ticks (0 = bar 1 beat 1). 4 bars = 64 ticks. */
  position: number;
  pitch: number;
  /** Duration in 16th-note ticks */
  duration: number;
  velocity: number;
}

export interface DNAProfile {
  rhythmGapBias: number;       // 0–1: higher = more rests
  repetitionBias: number;      // 0–1: higher = more repetition
  melodicLeapChance: number;   // 0–1
  bassDensity: number;         // 0–1
  noteLengthModifier: number;  // multiplier on duration
  tripletProbability: number;  // 0–1
  velocityVariance: number;    // 0–127
}

export interface GenreProfile {
  scaleBias: ScaleType[];
  bassRollChance: number;
  tripletChance: number;
  melodyDensity: number;  // notes per bar
  chordDensity: number;   // chords per bar
  velocityRange: [number, number];
}

export interface TelemetryScores {
  bounce: number;    // 0–100
  pocket: number;    // 0–100
  darkness: number;  // 0–100
}

export interface MutationNode {
  id: string;
  target: MutationTarget;
  seed: number;
  depth: number;
  parentId: string | null;
}

export interface EngineState {
  seed: number;
  genre: Genre;
  dna: DNAArchetype;
  key: number;       // 0–11 (C=0 … B=11)
  scale: ScaleType;
  bpm: number;
  mutationDepth: number;
  mutationPath: string[];
  mutationTree: MutationNode[];
  activeNodeId: string | null;
}

export interface GeneratedPack {
  chords: MidiEvent[];
  melody: MidiEvent[];
  bass: MidiEvent[];
  fingerprint: string;
  scores: TelemetryScores;
  state: EngineState;
}

export interface Snapshot {
  id: string;
  label: string;
  timestamp: number;
  state: EngineState;
  scores: TelemetryScores;
  fingerprint: string;
}
