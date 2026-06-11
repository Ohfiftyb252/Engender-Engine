import type { DrumEvent, DrumLane, Genre } from '../types';

/** General MIDI drum pitches (channel 10) */
export const DRUM_GM: Record<DrumLane, number> = {
  kick:    36,
  snare:   38,
  clap:    39,
  hat:     42,
  openHat: 46,
};

interface DrumSlot {
  pos: number;
  lane: DrumLane;
  vel: number;
  prob: number;
}

// 1-bar templates (16 ticks). Fractional positions = 32nd note accuracy.
const BASE_BAR: Record<Genre, DrumSlot[]> = {
  darkTrap: [
    // Kick on 1 and sometimes 3+offset
    { pos: 0,    lane: 'kick',  vel: 112, prob: 1.0 },
    { pos: 10,   lane: 'kick',  vel: 88,  prob: 0.55 },
    // Snare on beat 3 (tick 8)
    { pos: 8,    lane: 'snare', vel: 106, prob: 1.0 },
    { pos: 10,   lane: 'snare', vel: 72,  prob: 0.25 }, // ghost
    // 8th-note hats, some 16ths, 32nd flourish at bar end
    { pos: 0,    lane: 'hat',   vel: 68,  prob: 0.85 },
    { pos: 2,    lane: 'hat',   vel: 52,  prob: 0.55 },
    { pos: 4,    lane: 'hat',   vel: 72,  prob: 0.90 },
    { pos: 6,    lane: 'hat',   vel: 52,  prob: 0.55 },
    { pos: 8,    lane: 'hat',   vel: 68,  prob: 0.85 },
    { pos: 10,   lane: 'hat',   vel: 52,  prob: 0.55 },
    { pos: 12,   lane: 'hat',   vel: 72,  prob: 0.90 },
    { pos: 14,   lane: 'hat',   vel: 52,  prob: 0.55 },
    { pos: 14.5, lane: 'hat',   vel: 40,  prob: 0.40 },
    { pos: 15,   lane: 'hat',   vel: 48,  prob: 0.50 },
    { pos: 15.5, lane: 'hat',   vel: 40,  prob: 0.35 },
  ],
  ukDrill: [
    // Syncopated kick
    { pos: 0,    lane: 'kick',  vel: 110, prob: 1.0  },
    { pos: 3,    lane: 'kick',  vel: 85,  prob: 0.70 },
    { pos: 10,   lane: 'kick',  vel: 95,  prob: 0.75 },
    { pos: 14,   lane: 'kick',  vel: 78,  prob: 0.45 },
    // Snare only on beat 3
    { pos: 12,   lane: 'snare', vel: 110, prob: 1.0  },
    // Ghost snare
    { pos: 6,    lane: 'snare', vel: 60,  prob: 0.30 },
    // 16th hats, dense 32nd run near bar end
    { pos: 0,    lane: 'hat',   vel: 72,  prob: 0.90 },
    { pos: 2,    lane: 'hat',   vel: 56,  prob: 0.70 },
    { pos: 4,    lane: 'hat',   vel: 70,  prob: 0.88 },
    { pos: 6,    lane: 'hat',   vel: 56,  prob: 0.70 },
    { pos: 8,    lane: 'hat',   vel: 70,  prob: 0.88 },
    { pos: 10,   lane: 'hat',   vel: 56,  prob: 0.70 },
    { pos: 12,   lane: 'hat',   vel: 70,  prob: 0.88 },
    { pos: 14,   lane: 'hat',   vel: 56,  prob: 0.70 },
    { pos: 14.5, lane: 'hat',   vel: 52,  prob: 0.55 },
    { pos: 15,   lane: 'hat',   vel: 62,  prob: 0.65 },
    { pos: 15.5, lane: 'hat',   vel: 52,  prob: 0.55 },
  ],
  phonk: [
    // Memphis-style kick
    { pos: 0,    lane: 'kick',  vel: 114, prob: 1.0  },
    { pos: 6,    lane: 'kick',  vel: 88,  prob: 0.65 },
    { pos: 8,    lane: 'kick',  vel: 106, prob: 0.85 },
    { pos: 14,   lane: 'kick',  vel: 78,  prob: 0.45 },
    // Snare on 2 and 4 (half-time feel at beats 4 and 12)
    { pos: 4,    lane: 'snare', vel: 110, prob: 1.0  },
    { pos: 12,   lane: 'snare', vel: 104, prob: 1.0  },
    // Open hat accent
    { pos: 0,    lane: 'openHat', vel: 68, prob: 0.50 },
    { pos: 8,    lane: 'openHat', vel: 62, prob: 0.40 },
    // 16th hats
    { pos: 0,    lane: 'hat',   vel: 66,  prob: 0.80 },
    { pos: 2,    lane: 'hat',   vel: 50,  prob: 0.60 },
    { pos: 4,    lane: 'hat',   vel: 66,  prob: 0.80 },
    { pos: 6,    lane: 'hat',   vel: 50,  prob: 0.60 },
    { pos: 8,    lane: 'hat',   vel: 66,  prob: 0.80 },
    { pos: 10,   lane: 'hat',   vel: 50,  prob: 0.60 },
    { pos: 12,   lane: 'hat',   vel: 66,  prob: 0.80 },
    { pos: 14,   lane: 'hat',   vel: 50,  prob: 0.60 },
  ],
  jerseyClub: [
    // 3+3+2 kick pattern
    { pos: 0,    lane: 'kick',  vel: 116, prob: 1.0  },
    { pos: 3,    lane: 'kick',  vel: 100, prob: 0.90 },
    { pos: 6,    lane: 'kick',  vel: 108, prob: 0.85 },
    { pos: 9,    lane: 'kick',  vel: 94,  prob: 0.75 },
    // Clap on 2 and 4
    { pos: 4,    lane: 'clap',  vel: 112, prob: 1.0  },
    { pos: 12,   lane: 'clap',  vel: 110, prob: 1.0  },
    // Fast 16th hats with 32nd burst
    { pos: 0,    lane: 'hat',   vel: 76,  prob: 0.90 },
    { pos: 2,    lane: 'hat',   vel: 60,  prob: 0.80 },
    { pos: 4,    lane: 'hat',   vel: 72,  prob: 0.90 },
    { pos: 6,    lane: 'hat',   vel: 60,  prob: 0.80 },
    { pos: 8,    lane: 'hat',   vel: 72,  prob: 0.90 },
    { pos: 10,   lane: 'hat',   vel: 60,  prob: 0.80 },
    { pos: 12,   lane: 'hat',   vel: 72,  prob: 0.90 },
    { pos: 14,   lane: 'hat',   vel: 60,  prob: 0.80 },
    { pos: 14.5, lane: 'hat',   vel: 56,  prob: 0.65 },
    { pos: 15,   lane: 'hat',   vel: 66,  prob: 0.75 },
    { pos: 15.5, lane: 'hat',   vel: 56,  prob: 0.65 },
  ],
};

export function generateDrums(rng: () => number, genre: Genre, bars: number): DrumEvent[] {
  const template = BASE_BAR[genre];
  const totalTicks = bars * 16;
  const events: DrumEvent[] = [];

  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * 16;
    // Last bar gets a slight fill variation
    const isFill = bar === bars - 1;

    for (const slot of template) {
      const absPos = slot.pos + offset;
      if (absPos >= totalTicks) continue;

      // Probability gate
      let prob = slot.prob;
      if (isFill && (slot.lane === 'hat' || slot.lane === 'snare')) prob = Math.min(1, prob * 1.15);
      if (rng() > prob) continue;

      // Velocity humanize
      const velVar = Math.round((rng() - 0.5) * 22);
      const velocity = Math.max(30, Math.min(127, slot.vel + velVar));

      events.push({ position: absPos, lane: slot.lane, pitch: DRUM_GM[slot.lane], velocity });
    }

    // Add extra ghost notes on odd bars for variation
    if (bar % 2 === 1 && rng() < 0.45) {
      const ghostPos = offset + (rng() < 0.5 ? 5 : 13);
      if (ghostPos < totalTicks) {
        events.push({ position: ghostPos, lane: 'snare', pitch: DRUM_GM.snare, velocity: Math.round(40 + rng() * 28) });
      }
    }
  }

  return events.sort((a, b) => a.position - b.position || a.lane.localeCompare(b.lane));
}
