export const ENGINE_VERSION = "1.0.0";

export interface MutationLineage {
  parentSeed: string | null;
  mutationDepth: number;
  mutationPath: string[];
}

export interface EngineMetadata {
  masterSeed: string;
  genre: string;
  dnaArchetype: string;
  key: string;
  scale: string;
  bpm: number;
  lineage?: MutationLineage;
}

export function generateFingerprint(meta: EngineMetadata): string {
  const payload = [
    meta.masterSeed,
    meta.genre,
    meta.dnaArchetype,
    meta.key,
    meta.scale,
    meta.bpm,
    meta.lineage?.mutationDepth ?? 0,
    meta.lineage?.mutationPath?.join(">") ?? "base"
  ].join("|");

  let hash = 0;

  for (let i = 0; i < payload.length; i++) {
    hash = (hash << 5) - hash + payload.charCodeAt(i);
    hash |= 0;
  }

  return Math.abs(hash)
    .toString(36)
    .toUpperCase()
    .padStart(6, "0")
    .slice(0, 6);
}
