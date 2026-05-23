import type { MidiEvent } from '../types';

/**
 * Apply subtle timing and velocity humanization.
 * Max timing nudge ±1 tick, velocity ±humanizeRange.
 */
export function humanizeEvents(
  rng: () => number,
  events: MidiEvent[],
  humanizeRange: number,
): MidiEvent[] {
  return events.map(e => ({
    ...e,
    velocity: Math.max(30, Math.min(127, e.velocity + Math.round((rng() - 0.5) * humanizeRange * 2))),
    // Timing nudge is handled during MIDI export to preserve seed integrity
  }));
}
