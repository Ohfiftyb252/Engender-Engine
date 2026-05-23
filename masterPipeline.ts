import { initializeSeedBranches } from "./branchSeed";
import {
  generateFingerprint,
  ENGINE_VERSION,
  MutationLineage
} from "./fingerprint";

export interface PipelineConfig {
  masterSeed: string;
  genre: string;
  dnaArchetype: string;
  key: string;
  scale: string;
  bpm: number;
  lineage: MutationLineage;
}

function mockBuildGrid(genre: string, dna: string, rng: () => number) {
  void genre;
  void dna;

  return [1, 0, 1, 0, 1, 1, 0, 1].map((v) => v * rng());
}

export function runMasterPipeline(
  config: PipelineConfig,
  previousTrackStructure: unknown = null
) {
  const fingerprint = generateFingerprint(config);
  const branches = initializeSeedBranches(config.masterSeed);

  const chordsSeed = config.lineage.mutationPath.includes("chords")
    ? `${config.masterSeed}_chords_depth_${config.lineage.mutationDepth}`
    : config.masterSeed;

  const melodySeed = config.lineage.mutationPath.includes("melody")
    ? `${config.masterSeed}_melody_depth_${config.lineage.mutationDepth}`
    : config.masterSeed;

  const rhythmGrid = mockBuildGrid(
    config.genre,
    config.dnaArchetype,
    branches.rhythm
  );

  void rhythmGrid;

  const rawStructure = {
    chords: [
      {
        pitch: "F#2",
        duration: "1",
        velocity: 85,
        seedUsed: chordsSeed
      }
    ],
    melody: [
      {
        pitch: "F#5",
        duration: "4",
        velocity: 95,
        seedUsed: melodySeed
      }
    ],
    bass: [
      {
        pitch: "F#1",
        duration: "2",
        velocity: 110,
        seedUsed: config.masterSeed
      }
    ]
  };

  if (
    previousTrackStructure &&
    JSON.stringify(rawStructure.melody) ===
      JSON.stringify((previousTrackStructure as typeof rawStructure).melody)
  ) {
    return runMasterPipeline(
      {
        ...config,
        masterSeed: `${config.masterSeed}_reroll`
      },
      previousTrackStructure
    );
  }

  return {
    fingerprint,
    engineVersion: ENGINE_VERSION,
    structure: rawStructure,
    scores: {
      bounce: 90,
      darkness: 85,
      pocket: 95
    },
    config
  };
}
