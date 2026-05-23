import type { MidiEvent } from '../types';

/** Minimum semitone distance allowed between simultaneous melody and chord notes. */
const MELODY_CHORD_THRESHOLD = 2;
/** Minimum semitone distance allowed between simultaneous bass and chord notes. */
const BASS_CHORD_THRESHOLD = 3;

/**
 * Remove melody notes that collide too closely with chord notes at the same position.
 */
export function protectMelodyFromChords(
  melody: MidiEvent[],
  chords: MidiEvent[],
): MidiEvent[] {
  return melody.filter(m => {
    const overlapping = chords.filter(
      c => Math.abs(c.position - m.position) < 2,
    );
    for (const c of overlapping) {
      const dist = Math.abs(m.pitch - c.pitch) % 12;
      if (dist <= MELODY_CHORD_THRESHOLD && dist !== 0) return false;
    }
    return true;
  });
}

/**
 * Remove bass notes that clash too closely with chord notes (muddiness prevention).
 */
export function protectBassFromChords(
  bass: MidiEvent[],
  chords: MidiEvent[],
): MidiEvent[] {
  return bass.filter(b => {
    const overlapping = chords.filter(
      c => Math.abs(c.position - b.position) < 2,
    );
    for (const c of overlapping) {
      // Bass is in lower register, so absolute distance matters more than interval class
      const absDist = Math.abs(b.pitch - c.pitch);
      if (absDist < BASS_CHORD_THRESHOLD) return false;
    }
    return true;
  });
}

/**
 * Remove overlapping notes on the same track (same pitch at overlapping time).
 */
export function removeSameTrackOverlaps(events: MidiEvent[]): MidiEvent[] {
  const result: MidiEvent[] = [];
  for (const event of events) {
    const collision = result.some(
      e =>
        e.pitch === event.pitch &&
        e.position < event.position + event.duration &&
        event.position < e.position + e.duration,
    );
    if (!collision) result.push(event);
  }
  return result;
}

/** Apply all pocket protection passes. */
export function applyPocketProtection(
  chords: MidiEvent[],
  melody: MidiEvent[],
  bass: MidiEvent[],
): { chords: MidiEvent[]; melody: MidiEvent[]; bass: MidiEvent[] } {
  const cleanChords = removeSameTrackOverlaps(chords);
  const cleanMelody = removeSameTrackOverlaps(
    protectMelodyFromChords(melody, cleanChords),
  );
  const cleanBass = removeSameTrackOverlaps(
    protectBassFromChords(bass, cleanChords),
  );
  return { chords: cleanChords, melody: cleanMelody, bass: cleanBass };
}
