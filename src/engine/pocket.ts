import type { MidiEvent } from '../types';

const MELODY_CHORD_THRESHOLD = 2;
const BASS_CHORD_THRESHOLD = 3;

export function protectMelodyFromChords(melody: MidiEvent[], chords: MidiEvent[]): MidiEvent[] {
  return melody.filter(m => {
    const overlapping = chords.filter(c => Math.abs(c.position - m.position) < 2);
    for (const c of overlapping) {
      const dist = Math.abs(m.pitch - c.pitch) % 12;
      if (dist <= MELODY_CHORD_THRESHOLD && dist !== 0) return false;
    }
    return true;
  });
}

export function protectBassFromChords(bass: MidiEvent[], chords: MidiEvent[]): MidiEvent[] {
  return bass.filter(b => {
    const overlapping = chords.filter(c => Math.abs(c.position - b.position) < 2);
    for (const c of overlapping) {
      if (Math.abs(b.pitch - c.pitch) < BASS_CHORD_THRESHOLD) return false;
    }
    return true;
  });
}

export function removeSameTrackOverlaps(events: MidiEvent[]): MidiEvent[] {
  const result: MidiEvent[] = [];
  for (const event of events) {
    const collision = result.some(
      e => e.pitch === event.pitch &&
           e.position < event.position + event.duration &&
           event.position < e.position + e.duration,
    );
    if (!collision) result.push(event);
  }
  return result;
}

export function applyPocketProtection(chords: MidiEvent[], melody: MidiEvent[], bass: MidiEvent[]): { chords: MidiEvent[]; melody: MidiEvent[]; bass: MidiEvent[] } {
  const cleanChords = removeSameTrackOverlaps(chords);
  const cleanMelody = removeSameTrackOverlaps(protectMelodyFromChords(melody, cleanChords));
  const cleanBass   = removeSameTrackOverlaps(protectBassFromChords(bass, cleanChords));
  return { chords: cleanChords, melody: cleanMelody, bass: cleanBass };
}
