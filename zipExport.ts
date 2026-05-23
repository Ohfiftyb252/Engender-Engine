import JSZip from "jszip";
import { buildMidiTrack } from "./midiWriter";
import { downloadBlob } from "./downloadBlob";

export async function exportGeneratedPack(output: any) {
  const zip = new JSZip();

  const { structure, config, fingerprint, engineVersion, scores } = output;

  const manifest = {
    engineVersion,
    fingerprint,
    seed: config.masterSeed,
    genre: config.genre,
    dna: config.dnaArchetype,
    key: config.key,
    scale: config.scale,
    bpm: config.bpm,
    lineage: config.lineage,
    scores,
    exportedAt: new Date().toISOString()
  };

  zip.file("pack_manifest.json", JSON.stringify(manifest, null, 2));

  zip.file(
    `1_Chords_${config.key}_${config.scale}.mid`,
    buildMidiTrack("Chords", structure.chords, config.bpm)
  );

  zip.file(
    `2_Melody_${config.key}_${config.scale}.mid`,
    buildMidiTrack("Melody", structure.melody, config.bpm)
  );

  zip.file(
    `3_808_${config.bpm}BPM.mid`,
    buildMidiTrack("808 Bass", structure.bass, config.bpm)
  );

  const blob = await zip.generateAsync({ type: "blob" });

  downloadBlob(blob, `EngenderEngine_${fingerprint}_${config.bpm}BPM.zip`);
}
