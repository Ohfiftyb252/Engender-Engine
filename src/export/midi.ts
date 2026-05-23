// @ts-expect-error midi-writer-js has no bundled types
import MidiWriter from 'midi-writer-js';
import type { MidiEvent } from '../types';

const PPQ = 128;                         // midi-writer-js default
const TICKS_PER_16TH = PPQ / 4;         // 32 raw ticks per 16th-note grid tick

/**
 * Build a MIDI track using absolute startTick positioning.
 * This avoids all cursor-tracking issues and correctly places
 * simultaneous chord notes without wait-time drift.
 */
export function buildMidiTrack(events: MidiEvent[], trackName: string, bpm: number): Uint8Array {
  const track = new MidiWriter.Track();
  track.addTrackName(trackName);
  track.setTempo(bpm);

  // Stable sort: position ascending, then pitch ascending for reproducibility
  const sorted = [...events].sort((a, b) => a.position - b.position || a.pitch - b.pitch);

  for (const e of sorted) {
    track.addNote({
      pitch: e.pitch,
      duration: ticksToMidiDuration(Math.max(1, e.duration)),
      startTick: e.position * TICKS_PER_16TH,
      velocity: Math.max(1, Math.min(100, Math.round((e.velocity / 127) * 100))),
    });
  }

  const writer = new MidiWriter.Writer([track]);
  const b64 = writer.dataUri();
  return base64ToUint8Array(b64.split(',')[1]);
}

function ticksToMidiDuration(ticks: number): string {
  if (ticks === 0) return '0';
  const map: [number, string][] = [
    [16, '1'],
    [8,  '2'],
    [4,  '4'],
    [2,  '8'],
    [1,  '16'],
  ];
  for (const [t, d] of map) {
    if (ticks === t) return d;
  }
  return `T${ticks * TICKS_PER_16TH}`;
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
