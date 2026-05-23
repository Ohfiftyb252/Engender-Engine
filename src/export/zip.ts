import JSZip from 'jszip';
import type { GeneratedPack } from '../types';
import { buildMidiTrack } from './midi';

export interface ExportManifest {
  engineVersion: string;
  fingerprint: string;
  seed: number;
  genre: string;
  dna: string;
  key: number;
  scale: string;
  bpm: number;
  scores: Record<string, number>;
  mutationDepth: number;
  mutationPath: string[];
  exportTimestamp: string;
}

export async function buildZip(pack: GeneratedPack): Promise<Blob> {
  const zip = new JSZip();
  const { state, scores, fingerprint } = pack;

  const chordMidi  = buildMidiTrack(pack.chords, '1_Chords',  state.bpm);
  const melodyMidi = buildMidiTrack(pack.melody, '2_Melody',  state.bpm);
  const bassMidi   = buildMidiTrack(pack.bass,   '3_808',     state.bpm);

  zip.file('1_Chords.mid',  chordMidi);
  zip.file('2_Melody.mid',  melodyMidi);
  zip.file('3_808.mid',     bassMidi);

  const manifest: ExportManifest = {
    engineVersion: '1.0.0',
    fingerprint,
    seed: state.seed,
    genre: state.genre,
    dna: state.dna,
    key: state.key,
    scale: state.scale,
    bpm: state.bpm,
    scores: { bounce: scores.bounce, pocket: scores.pocket, darkness: scores.darkness },
    mutationDepth: state.mutationDepth,
    mutationPath: state.mutationPath,
    exportTimestamp: new Date().toISOString(),
  };

  zip.file('pack_manifest.json', JSON.stringify(manifest, null, 2));

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

/** Trigger a ZIP download in the browser (Safari + Android safe). */
export function downloadZip(blob: Blob, fingerprint: string, bpm: number): void {
  const filename = `EngenderEngine_${fingerprint}_${bpm}BPM.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 1000);
}
