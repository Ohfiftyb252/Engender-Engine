import JSZip from 'jszip';
import type { GeneratedPack } from '../types';
import { buildMidiTrack } from './midi';
import { NOTE_NAMES } from '../engine/scale';

export async function buildZip(pack: GeneratedPack, loopMode: 1 | 2 | 4 = 1): Promise<Blob> {
  const zip = new JSZip();
  const { state, scores, fingerprint } = pack;
  const bars = state.bars ?? 4;

  zip.file('1_Chords.mid', buildMidiTrack(pack.chords, '1_Chords', state.bpm));
  zip.file('2_Melody.mid', buildMidiTrack(pack.melody, '2_Melody', state.bpm));
  zip.file('3_808.mid',    buildMidiTrack(pack.bass,   '3_808',    state.bpm));

  zip.file('pack_manifest.json', JSON.stringify({
    engineVersion: '1.0.0',
    fingerprint,
    seed: state.seed,
    genre: state.genre,
    dna: state.dna,
    key: state.key,
    keyName: NOTE_NAMES[state.key % 12],
    scale: state.scale,
    bpm: state.bpm,
    bars,
    loopMode,
    scores: { bounce: scores.bounce, pocket: scores.pocket, darkness: scores.darkness },
    mutationDepth: state.mutationDepth,
    mutationPath: state.mutationPath,
    voiceSeeds: state.voiceSeeds,
    exportTimestamp: new Date().toISOString(),
  }, null, 2));

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

export function downloadZip(blob: Blob, fingerprint: string, bpm: number, bars = 4): void {
  const filename = `EngenderEngine_${fingerprint}_${bpm}BPM_${bars}bars.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}
