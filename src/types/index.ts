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

export type MutationTarget = 'melody' | 'bass' | 'chords' | 'drums';

export type DrumLane = 'kick' | 'snare' | 'clap' | 'hat' | 'openHat';

export interface MidiEvent {
  /** Position in 16th-note ticks (0 = bar 1 beat 1). 4 bars = 64 ticks. */
  position: number;
  pitch: number;
  /** Duration in 16th-note ticks */
  duration: number;
  velocity: number;
}

export interface DrumEvent {
  /** Position in 16th-note ticks. May be fractional (e.g. 14.5 = 32nd note offset). */
  position: number;
  lane: DrumLane;
  /** GM drum pitch (36=kick, 38=snare, 39=clap, 42=hat, 46=openHat) */
  pitch: number;
  velocity: number;
}

export interface DrumPattern {
  events: DrumEvent[];
}

export interface PackValidationResult {
  valid: boolean;
  issues: string[];
  /** Lanes that need repair */
  weakLanes: Array<'chords' | 'bass' | 'melody' | 'drums'>;
}

export interface DNAProfile {
  rhythmGapBias: number;
  repetitionBias: number;
  melodicLeapChance: number;
  bassDensity: number;
  noteLengthModifier: number;
  tripletProbability: number;
  velocityVariance: number;
}

export interface GenreProfile {
  scaleBias: ScaleType[];
  bassRollChance: number;
  tripletChance: number;
  melodyDensity: number;
  chordDensity: number;
  velocityRange: [number, number];
}

export interface TelemetryScores {
  bounce: number;
  pocket: number;
  darkness: number;
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
  key: number;
  scale: ScaleType;
  bpm: number;
  bars: number;
  mutationDepth: number;
  mutationPath: string[];
  mutationTree: MutationNode[];
  activeNodeId: string | null;
  /**
   * Per-voice mutation seeds. When present, the corresponding voice uses
   * this seed instead of the master branch. Master seed is NEVER mutated.
   */
  voiceSeeds: Partial<Record<MutationTarget, number>>;
}

export interface GeneratedPack {
  chords: MidiEvent[];
  melody: MidiEvent[];
  bass: MidiEvent[];
  drums: DrumPattern;
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
