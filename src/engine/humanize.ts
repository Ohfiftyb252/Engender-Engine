import type { MidiEvent } from '../types';

export function humanizeEvents(rng: () => number, events: MidiEvent[], humanizeRange: number): MidiEvent[] {
  return events.map(e => ({
    ...e,
    velocity: Math.max(30, Math.min(127, e.velocity + Math.round((rng() - 0.5) * humanizeRange * 2))),
  }));
}
