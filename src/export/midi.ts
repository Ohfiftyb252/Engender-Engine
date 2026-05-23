// @ts-expect-error midi-writer-js has no bundled types
import MidiWriter from 'midi-writer-js';
import type { MidiEvent } from '../types';

const PPQ = 128; // pulses per quarter note (midi-writer-js default)
const TICKS_PER_16TH = PPQ / 4; // 32 ticks per 16th note

/**
 * Convert an array of MidiEvents into a raw MIDI file Uint8Array.
 * trackName is embedded in the MIDI for DAW display.
 */
export function buildMidiTrack(events: MidiEvent[], trackName: string, bpm: number): Uint8Array {
  const track = new MidiWriter.Track();
  track.addTrackName(trackName);
  track.setTempo(bpm);

  // Sort by position
  const sorted = [...events].sort((a, b) => a.position - b.position);

  let cursor = 0; // current position in 16th-note ticks

  for (const e of sorted) {
    const waitTicks = Math.max(0, e.position - cursor);
    const waitDuration = ticksToMidiDuration(waitTicks);
    const noteDuration = ticksToMidiDuration(Math.max(1, e.duration));

    track.addNote({
      pitch: e.pitch,
      duration: noteDuration,
      wait: waitDuration,
      velocity: Math.max(1, Math.min(100, Math.round(e.velocity / 127 * 100))),
    });

    cursor = e.position + e.duration;
  }

  const writer = new MidiWriter.Writer([track]);
  const b64 = writer.dataUri();
  return base64ToUint8Array(b64.split(',')[1]);
}

/**
 * Convert 16th-note ticks to midi-writer-js duration string.
 * midi-writer-js uses: '1'=whole, '2'=half, '4'=quarter, '8'=eighth, '16'=16th
 * For non-standard durations we use tick notation: 'Tn' where n is raw PPQ ticks.
 */
function ticksToMidiDuration(ticks: number): string {
  if (ticks === 0) return '0';
  const map: [number, string][] = [
    [16, '1'],   // whole note = 16 sixteenths
    [8,  '2'],   // half
    [4,  '4'],   // quarter
    [2,  '8'],   // eighth
    [1,  '16'],  // sixteenth
  ];
  for (const [t, d] of map) {
    if (ticks === t) return d;
  }
  // Fallback: express as raw ticks
  const rawTicks = ticks * TICKS_PER_16TH;
  return `T${rawTicks}`;
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
