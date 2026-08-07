import JSZip from 'jszip';
import type { GeneratedPack } from '../types';
import { buildMidiTrack, buildDrumTrack } from './midi';
import { NOTE_NAMES } from '../engine/scale';
import { ENGINE_VERSION, RENDER_VERSION, APP_VERSION } from '../engine/fingerprint';
import { validatePocketPack } from '../engine/validatePack';

export async function buildZip(
  pack: GeneratedPack,
  loopMode: 1 | 2 | 4 = 1,
  previewWav?: Uint8Array,
  melodyStemWav?: Uint8Array,
  repairWarnings?: string[],
): Promise<Blob> {
  const zip = new JSZip();
  const { state, scores, fingerprint } = pack;
  const bars = state.bars ?? 4;
  const keyName = NOTE_NAMES[state.key % 12];
  const exportTimestamp = new Date().toISOString();

  // Root folder name matches FL Mobile convention
  const root  = `ENGENDER_${keyName}_${state.bpm}BPM_${fingerprint}`;
  const midiDir  = `${root}/MIDI_Files`;
  const audioDir = `${root}/Audio_Stems_WAV`;

  // ── MIDI Files ────────────────────────────────────────────────────────────
  zip.file(`${midiDir}/${fingerprint}_Chords.mid`,          buildMidiTrack(pack.chords, '1_Chords', state.bpm));
  zip.file(`${midiDir}/${fingerprint}_Bass.mid`,            buildMidiTrack(pack.bass,   '3_808',    state.bpm));
  zip.file(`${midiDir}/${fingerprint}_Melody.mid`,          buildMidiTrack(pack.melody, '2_Melody', state.bpm));
  zip.file(`${midiDir}/${fingerprint}_Drums_FLMobile.mid`,  buildDrumTrack(pack.drums.events, state.bpm));

  // ── Audio Stems ───────────────────────────────────────────────────────────
  if (previewWav) {
    zip.file(`${audioDir}/${fingerprint}_FullPreview.wav`, previewWav);
  }
  if (melodyStemWav) {
    zip.file(`${audioDir}/${fingerprint}_Melody_DarkSaw.wav`, melodyStemWav);
  }

  // ── Pocketprint.json — consolidated metadata ──────────────────────────────
  const validation = validatePocketPack(pack);
  const warnings   = repairWarnings ?? [];

  const pocketprint = {
    app:     'ENGENDER ENGINE™',
    version: APP_VERSION,
    engineVersion: ENGINE_VERSION,
    renderVersion: RENDER_VERSION,
    fingerprint,
    exportTimestamp,
    pack: {
      seed:  state.seed,
      genre: state.genre,
      dna:   state.dna,
      key:   state.key,
      keyName,
      scale: state.scale,
      bpm:   state.bpm,
      bars,
      loopMode,
    },
    telemetry: {
      bounce:      scores.bounce,
      pocket:      scores.pocket,
      darkness:    scores.darkness,
      originality: scores.originality,
      tension:     scores.tension,
      movement:    scores.movement,
      simplicity:  scores.simplicity,
    },
    validation: { valid: validation.valid, issues: validation.issues },
    repairWarnings: warnings,
    mutationHistory: {
      depth: state.mutationDepth,
      path:  state.mutationPath,
      tree:  state.mutationTree,
    },
    voiceSeeds: state.voiceSeeds,
    lanes: {
      kick:   pack.drums.events.filter(e => e.lane === 'kick')    .map(e => ({ position: e.position, velocity: e.velocity })),
      snare:  pack.drums.events.filter(e => e.lane === 'snare')   .map(e => ({ position: e.position, velocity: e.velocity })),
      clap:   pack.drums.events.filter(e => e.lane === 'clap')    .map(e => ({ position: e.position, velocity: e.velocity })),
      hat:    pack.drums.events.filter(e => e.lane === 'hat')     .map(e => ({ position: e.position, velocity: e.velocity })),
      open:   pack.drums.events.filter(e => e.lane === 'openHat') .map(e => ({ position: e.position, velocity: e.velocity })),
      '808':  pack.bass  .map(e => ({ position: e.position, velocity: e.velocity })),
      melody: pack.melody.map(e => ({ position: e.position, velocity: e.velocity })),
      chords: pack.chords.map(e => ({ position: e.position, velocity: e.velocity })),
    },
    laneCounts: {
      chords: pack.chords.length,
      melody: pack.melody.length,
      bass:   pack.bass.length,
      drums:  pack.drums.events.length,
    },
    files: buildFileList(fingerprint, !!previewWav, !!melodyStemWav),
    flMobileNotes: [
      `${fingerprint}_Drums_FLMobile.mid uses General MIDI channel 10 (GM drum kit).`,
      'In FL Studio Mobile: Add Drum channel → Import MIDI → select this file.',
      'Kick=36, Snare=38, Clap=39, ClosedHat=42, OpenHat=46.',
      `${fingerprint}_Bass.mid is the 808/bass line — load on Sub Bass or 808 instrument.`,
      `${fingerprint}_Chords.mid and ${fingerprint}_Melody.mid load on any melodic synth.`,
      `${fingerprint}_Melody_DarkSaw.wav is a pre-rendered dark saw stem for direct sampling.`,
      `${fingerprint}_FullPreview.wav is the full 1× dry mix — useful for reference.`,
    ].join(' '),
  };

  zip.file(`${root}/Pocketprint.json`, JSON.stringify(pocketprint, null, 2));

  // ── ReadMe.txt ────────────────────────────────────────────────────────────
  zip.file(`${root}/ReadMe.txt`, buildReadMe(pack, fingerprint, keyName, warnings, loopMode));

  return zip.generateAsync({ type: 'blob', compression: 'DEFLATE', compressionOptions: { level: 6 } });
}

function buildFileList(fp: string, hasPreview: boolean, hasMelodyStem: boolean): string[] {
  return [
    `MIDI_Files/${fp}_Chords.mid`,
    `MIDI_Files/${fp}_Bass.mid`,
    `MIDI_Files/${fp}_Melody.mid`,
    `MIDI_Files/${fp}_Drums_FLMobile.mid`,
    ...(hasPreview    ? [`Audio_Stems_WAV/${fp}_FullPreview.wav`]    : []),
    ...(hasMelodyStem ? [`Audio_Stems_WAV/${fp}_Melody_DarkSaw.wav`] : []),
    'Pocketprint.json',
    'ReadMe.txt',
  ];
}

function buildReadMe(
  pack: GeneratedPack,
  fingerprint: string,
  keyName: string,
  warnings: string[],
  loopMode: number,
): string {
  const { state, scores } = pack;
  const bars = state.bars ?? 4;
  const scaleLabel = state.scale.replace(/([A-Z])/g, ' $1').toUpperCase().trim();
  const repairLine = warnings.length > 0
    ? `REPAIR LOG    : ${warnings.join(', ')}`
    : 'REPAIR LOG    : PACK VALID — NO REPAIRS NEEDED';

  return [
    `ENGENDER ENGINE™ v${APP_VERSION} — Pocket Pack`,
    '='.repeat(50),
    '',
    `FINGERPRINT   : ${fingerprint}`,
    `KEY / SCALE   : ${keyName} ${scaleLabel}`,
    `BPM           : ${state.bpm}`,
    `BARS          : ${bars} bars × ${loopMode}× loop`,
    `GENRE / DNA   : ${state.genre.toUpperCase()} / ${state.dna.toUpperCase()}`,
    repairLine,
    '',
    'TELEMETRY',
    '-'.repeat(30),
    `  Bounce      ${scores.bounce}   Pocket    ${scores.pocket}`,
    `  Darkness    ${scores.darkness}   Original  ${scores.originality}`,
    `  Tension     ${scores.tension}   Movement  ${scores.movement}`,
    `  Simplicity  ${scores.simplicity}`,
    '',
    'FILES IN THIS PACK',
    '-'.repeat(30),
    '  MIDI_Files/',
    `    ${fingerprint}_Chords.mid`,
    `    ${fingerprint}_Bass.mid`,
    `    ${fingerprint}_Melody.mid`,
    `    ${fingerprint}_Drums_FLMobile.mid`,
    '  Audio_Stems_WAV/',
    `    ${fingerprint}_FullPreview.wav`,
    `    ${fingerprint}_Melody_DarkSaw.wav`,
    '  Pocketprint.json   (full metadata, telemetry, mutation history)',
    '  ReadMe.txt',
    '',
    'FL STUDIO MOBILE IMPORT GUIDE',
    '-'.repeat(30),
    '  DRUMS:',
    '    Add channel → Drum Kit → Import MIDI → Drums_FLMobile.mid',
    '    Kick=36  Snare=38  Clap=39  ClosedHat=42  OpenHat=46',
    '  808/BASS:',
    '    Add channel → Sub Bass / 808 → Import MIDI → Bass.mid',
    '  MELODY:',
    '    Add channel → Synth → Import MIDI → Melody.mid',
    '    OR: Sample the Melody_DarkSaw.wav stem directly',
    '  CHORDS:',
    '    Add channel → Pad / Synth → Import MIDI → Chords.mid',
    '',
    `Generated with ENGENDER ENGINE™ v${APP_VERSION}  engineVersion=${APP_VERSION}`,
  ].join('\n');
}

export function downloadZip(blob: Blob, fingerprint: string, bpm: number, keyName: string, bars = 4): void {
  const filename = `ENGENDER_${keyName}_${bpm}BPM_${fingerprint}_${bars}bars.zip`;
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url; a.download = filename;
  document.body.appendChild(a); a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}
