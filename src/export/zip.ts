import JSZip from 'jszip';
import type { GeneratedPack } from '../types';
import { buildMidiTrack, buildDrumTrack } from './midi';
import { NOTE_NAMES } from '../engine/scale';
import { ENGINE_VERSION, RENDER_VERSION } from '../engine/fingerprint';
import { validatePocketPack } from '../engine/validatePack';

export async function buildZip(
  pack: GeneratedPack,
  loopMode: 1 | 2 | 4 = 1,
  previewWav?: Uint8Array,
): Promise<Blob> {
  const zip = new JSZip();
  const { state, scores, fingerprint } = pack;
  const bars = state.bars ?? 4;

  zip.file('1_Chords.mid',           buildMidiTrack(pack.chords, '1_Chords', state.bpm));
  zip.file('2_Melody.mid',           buildMidiTrack(pack.melody, '2_Melody', state.bpm));
  zip.file('3_808.mid',              buildMidiTrack(pack.bass,   '3_808',    state.bpm));
  zip.file('4_Drums_FLMobile.mid',   buildDrumTrack(pack.drums.events, state.bpm));

  if (previewWav) {
    zip.file('preview.wav', previewWav);
  }

  const validation = validatePocketPack(pack);
  const includedFiles = [
    '1_Chords.mid',
    '2_Melody.mid',
    '3_808.mid',
    '4_Drums_FLMobile.mid',
    ...(previewWav ? ['preview.wav'] : []),
    'pack_manifest.json',
  ];

  zip.file('pack_manifest.json', JSON.stringify({
    appName: 'ENGENDER ENGINE™',
    engineVersion: ENGINE_VERSION,
    renderVersion: RENDER_VERSION,
    fingerprint,
    seed: state.seed,
    bpm: state.bpm,
    bars,
    loopMode,
    key: state.key,
    keyName: NOTE_NAMES[state.key % 12],
    scale: state.scale,
    genre: state.genre,
    dna: state.dna,
    mutationDepth: state.mutationDepth,
    mutationPath: state.mutationPath,
    voiceSeeds: state.voiceSeeds,
    scores: { bounce: scores.bounce, pocket: scores.pocket, darkness: scores.darkness },
    laneCounts: {
      chords: pack.chords.length,
      melody: pack.melody.length,
      bass:   pack.bass.length,
      drums:  pack.drums.events.length,
    },
    validation: { valid: validation.valid, issues: validation.issues },
    includedFiles,
    flMobileNotes: [
      '4_Drums_FLMobile.mid uses General MIDI channel 10 (GM drum kit).',
      'In FL Studio Mobile: add a Drum channel → Import MIDI → select this file.',
      'Kick=36, Snare=38, Clap=39, ClosedHat=42, OpenHat=46.',
      '3_808.mid is the 808/bass line — load on a Sub Bass or 808 instrument.',
      '1_Chords.mid and 2_Melody.mid load on any melodic synth.',
      'preview.wav is a 1x dry render — useful for reference in your session.',
    ].join(' '),
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
