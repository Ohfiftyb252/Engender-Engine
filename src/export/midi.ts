// @ts-expect-error midi-writer-js has no bundled types
import MidiWriter from 'midi-writer-js';
import type { DrumEvent, MidiEvent } from '../types';

const PPQ = 128;
const TICKS_PER_16TH = PPQ / 4; // 32 ticks per 16th note

/**
 * Build a melodic MIDI track.
 * Fractional positions (e.g. 14.5 = 32nd-note offset) work via Math.round().
 */
export function buildMidiTrack(events: MidiEvent[], trackName: string, bpm: number): Uint8Array {
  const track = new MidiWriter.Track();
  track.addTrackName(trackName);
  track.setTempo(bpm);

  const sorted = [...events].sort((a, b) => a.position - b.position || a.pitch - b.pitch);

  for (const e of sorted) {
    track.addNote({
      pitch: e.pitch,
      duration: ticksToMidiDuration(Math.max(1, e.duration)),
      startTick: Math.round(e.position * TICKS_PER_16TH),
      velocity: Math.max(1, Math.min(100, Math.round((e.velocity / 127) * 100))),
    });
  }

  return trackToBytes(track);
}

/**
 * Build a GM drum MIDI track on channel 10.
 * Fractional positions (32nd-note accuracy) are preserved:
 *   position 14.5 → startTick 464 (= 29 × 16, exact 32nd-note tick at PPQ=128)
 */
export function buildDrumTrack(events: DrumEvent[], bpm: number): Uint8Array {
  const track = new MidiWriter.Track();
  track.addTrackName('4_Drums_FLMobile');
  track.setTempo(bpm);

  const sorted = [...events].sort((a, b) => a.position - b.position);

  for (const e of sorted) {
    track.addNote({
      pitch: e.pitch,
      duration: '32',  // short percussive hit (32nd note)
      startTick: Math.round(e.position * TICKS_PER_16TH),
      velocity: Math.max(1, Math.min(100, Math.round((e.velocity / 127) * 100))),
      channel: 10,     // General MIDI drum channel (1-indexed)
    } as never);
  }

  return trackToBytes(track);
}

function ticksToMidiDuration(ticks: number): string {
  if (ticks === 0) return '0';
  const map: [number, string][] = [[16,'1'],[8,'2'],[4,'4'],[2,'8'],[1,'16']];
  for (const [t, d] of map) if (ticks === t) return d;
  return `T${ticks * TICKS_PER_16TH}`;
}

function trackToBytes(track: unknown): Uint8Array {
  const writer = new MidiWriter.Writer([track]);
  const b64 = (writer as { dataUri(): string }).dataUri();
  return base64ToUint8Array(b64.split(',')[1]);
}

function base64ToUint8Array(b64: string): Uint8Array {
  const bin = atob(b64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  return bytes;
}
