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
    { pos: 0,    lane: 'kick',  vel: 112, prob: 1.0  },
    { pos: 10,   lane: 'kick',  vel: 88,  prob: 0.55 },
    { pos: 8,    lane: 'snare', vel: 106, prob: 1.0  },
    { pos: 10,   lane: 'snare', vel: 72,  prob: 0.25 },
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
    { pos: 0,    lane: 'kick',  vel: 110, prob: 1.0  },
    { pos: 3,    lane: 'kick',  vel: 85,  prob: 0.70 },
    { pos: 10,   lane: 'kick',  vel: 95,  prob: 0.75 },
    { pos: 14,   lane: 'kick',  vel: 78,  prob: 0.45 },
    { pos: 12,   lane: 'snare', vel: 110, prob: 1.0  },
    { pos: 6,    lane: 'snare', vel: 60,  prob: 0.30 },
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
    { pos: 0,    lane: 'kick',    vel: 114, prob: 1.0  },
    { pos: 6,    lane: 'kick',    vel: 88,  prob: 0.65 },
    { pos: 8,    lane: 'kick',    vel: 106, prob: 0.85 },
    { pos: 14,   lane: 'kick',    vel: 78,  prob: 0.45 },
    { pos: 4,    lane: 'snare',   vel: 110, prob: 1.0  },
    { pos: 12,   lane: 'snare',   vel: 104, prob: 1.0  },
    { pos: 0,    lane: 'openHat', vel: 68,  prob: 0.50 },
    { pos: 8,    lane: 'openHat', vel: 62,  prob: 0.40 },
    { pos: 0,    lane: 'hat',     vel: 66,  prob: 0.80 },
    { pos: 2,    lane: 'hat',     vel: 50,  prob: 0.60 },
    { pos: 4,    lane: 'hat',     vel: 66,  prob: 0.80 },
    { pos: 6,    lane: 'hat',     vel: 50,  prob: 0.60 },
    { pos: 8,    lane: 'hat',     vel: 66,  prob: 0.80 },
    { pos: 10,   lane: 'hat',     vel: 50,  prob: 0.60 },
    { pos: 12,   lane: 'hat',     vel: 66,  prob: 0.80 },
    { pos: 14,   lane: 'hat',     vel: 50,  prob: 0.60 },
  ],
  jerseyClub: [
    { pos: 0,    lane: 'kick', vel: 116, prob: 1.0  },
    { pos: 3,    lane: 'kick', vel: 100, prob: 0.90 },
    { pos: 6,    lane: 'kick', vel: 108, prob: 0.85 },
    { pos: 9,    lane: 'kick', vel: 94,  prob: 0.75 },
    { pos: 4,    lane: 'clap', vel: 112, prob: 1.0  },
    { pos: 12,   lane: 'clap', vel: 110, prob: 1.0  },
    { pos: 0,    lane: 'hat',  vel: 76,  prob: 0.90 },
    { pos: 2,    lane: 'hat',  vel: 60,  prob: 0.80 },
    { pos: 4,    lane: 'hat',  vel: 72,  prob: 0.90 },
    { pos: 6,    lane: 'hat',  vel: 60,  prob: 0.80 },
    { pos: 8,    lane: 'hat',  vel: 72,  prob: 0.90 },
    { pos: 10,   lane: 'hat',  vel: 60,  prob: 0.80 },
    { pos: 12,   lane: 'hat',  vel: 72,  prob: 0.90 },
    { pos: 14,   lane: 'hat',  vel: 60,  prob: 0.80 },
    { pos: 14.5, lane: 'hat',  vel: 56,  prob: 0.65 },
    { pos: 15,   lane: 'hat',  vel: 66,  prob: 0.75 },
    { pos: 15.5, lane: 'hat',  vel: 56,  prob: 0.65 },
  ],
};

// Open-hat swap slots for section 2 (breakdown/texture change)
const OPEN_HAT_SWAP: DrumSlot[] = [
  { pos: 2,  lane: 'openHat', vel: 72, prob: 0.70 },
  { pos: 6,  lane: 'openHat', vel: 60, prob: 0.55 },
  { pos: 10, lane: 'openHat', vel: 72, prob: 0.70 },
  { pos: 14, lane: 'openHat', vel: 60, prob: 0.55 },
];

// Dense 32nd hat run for final-push section
const HAT_RUN_32: DrumSlot[] = [
  { pos: 12,   lane: 'hat', vel: 80, prob: 0.88 },
  { pos: 12.5, lane: 'hat', vel: 60, prob: 0.72 },
  { pos: 13,   lane: 'hat', vel: 78, prob: 0.88 },
  { pos: 13.5, lane: 'hat', vel: 58, prob: 0.72 },
  { pos: 14,   lane: 'hat', vel: 84, prob: 0.92 },
  { pos: 14.5, lane: 'hat', vel: 62, prob: 0.78 },
  { pos: 15,   lane: 'hat', vel: 80, prob: 0.88 },
  { pos: 15.5, lane: 'hat', vel: 64, prob: 0.78 },
];

// 8th-note triplet hat roll — 3 per beat, 12 total across 4 beats
// Triplet grid: beat * 4 + [0, 4/3, 8/3] = [0, 1.33, 2.67, 4, 5.33, 6.67, ...]
const T = 4 / 3; // ticks per 8th-note triplet subdivision
const TRIPLET_BEATS = [0, 1, 2, 3] as const;
const HAT_TRIPLETS: DrumSlot[] = TRIPLET_BEATS.flatMap(beat => [
  { pos: beat * 4,         lane: 'hat', vel: 82, prob: 0.88 },
  { pos: beat * 4 + T,     lane: 'hat', vel: 58, prob: 0.82 },
  { pos: beat * 4 + T * 2, lane: 'hat', vel: 70, prob: 0.78 },
]);

// Triplet kick roll — 3 quick kicks on beat 4 (bars 12, 13.33, 14.67)
const KICK_TRIPLETS: DrumSlot[] = [
  { pos: 12,         lane: 'kick', vel: 98, prob: 0.85 },
  { pos: 12 + T,     lane: 'kick', vel: 72, prob: 0.75 },
  { pos: 12 + T * 2, lane: 'kick', vel: 84, prob: 0.80 },
];

// Transition fill on the last bar of a section
const SECTION_FILL: DrumSlot[] = [
  { pos: 8,    lane: 'snare', vel: 100, prob: 0.90 },
  { pos: 10,   lane: 'snare', vel: 80,  prob: 0.80 },
  { pos: 12,   lane: 'snare', vel: 90,  prob: 0.85 },
  { pos: 13,   lane: 'snare', vel: 70,  prob: 0.70 },
  { pos: 14,   lane: 'snare', vel: 100, prob: 0.95 },
  { pos: 14.5, lane: 'hat',   vel: 72,  prob: 0.85 },
  { pos: 15,   lane: 'hat',   vel: 80,  prob: 0.90 },
  { pos: 15.5, lane: 'hat',   vel: 72,  prob: 0.85 },
];

export function generateDrums(rng: () => number, genre: Genre, bars: number): DrumEvent[] {
  const template = BASE_BAR[genre];
  const totalTicks = bars * 16;
  const events: DrumEvent[] = [];

  for (let bar = 0; bar < bars; bar++) {
    const offset = bar * 16;

    // ── 8-bar section system ─────────────────────────────────────────────
    const section = Math.floor(bar / 8);           // 0=cold, 1=main, 2=switch, 3=final
    const posInSection = bar % 8;
    const isTransitionBar = posInSection === 7 && bar < bars - 1 && bars >= 8; // last bar before section change
    const isFinalBar = bar === bars - 1;

    // Per-section energy multipliers
    const velMult =
      section === 0 ? 0.82 :   // cold open — pull back
      section === 1 ? 1.00 :   // main bounce — full power
      section === 2 ? 0.88 :   // switch/texture — slightly stripped
                      1.12;    // final push — maximum heat

    const probMult =
      section === 0 ? 0.88 :
      section === 1 ? 1.00 :
      section === 2 ? 0.92 :
                      1.05;

    // ── Base template ────────────────────────────────────────────────────
    for (const slot of template) {
      // Section 2: suppress closed hats — replaced by open hats below
      if (section === 2 && slot.lane === 'hat' && slot.pos % 4 !== 0) continue;

      const absPos = slot.pos + offset;
      if (absPos >= totalTicks) continue;

      let prob = slot.prob * probMult;
      // Fill boost on transition or final bar
      if ((isTransitionBar || isFinalBar) && (slot.lane === 'hat' || slot.lane === 'snare'))
        prob = Math.min(1, prob * 1.18);

      if (rng() > prob) continue;

      const velVar = Math.round((rng() - 0.5) * 22);
      const velocity = Math.max(30, Math.min(127, Math.round(slot.vel * velMult) + velVar));
      events.push({ position: absPos, lane: slot.lane, pitch: DRUM_GM[slot.lane], velocity });
    }

    // ── Section-specific additions ───────────────────────────────────────

    // Section 2: open hat swap (gives the breakdown texture)
    if (section === 2) {
      for (const slot of OPEN_HAT_SWAP) {
        const absPos = slot.pos + offset;
        if (absPos >= totalTicks) continue;
        if (rng() < slot.prob * probMult)
          events.push({ position: absPos, lane: slot.lane, pitch: DRUM_GM.openHat,
            velocity: Math.max(30, Math.round(slot.vel * velMult + (rng() - 0.5) * 16)) });
      }
    }

    // Section 3: dense 32nd hat run
    if (section === 3) {
      for (const slot of HAT_RUN_32) {
        const absPos = slot.pos + offset;
        if (absPos >= totalTicks) continue;
        if (rng() < slot.prob)
          events.push({ position: absPos, lane: slot.lane, pitch: DRUM_GM.hat,
            velocity: Math.max(30, Math.round(slot.vel * velMult + (rng() - 0.5) * 14)) });
      }
    }

    // Transition fill on last bar of each section
    if (isTransitionBar) {
      for (const slot of SECTION_FILL) {
        const absPos = slot.pos + offset;
        if (absPos >= totalTicks) continue;
        if (rng() < slot.prob)
          events.push({ position: absPos, lane: slot.lane, pitch: DRUM_GM[slot.lane],
            velocity: Math.max(30, Math.min(127, Math.round(slot.vel + (rng() - 0.5) * 16))) });
      }
    }

    // ── TRIPLET HITS ─────────────────────────────────────────────────────────
    // Per-genre triplet probability — darkTrap/phonk love triplets, ukDrill less so
    const tripletBase =
      genre === 'darkTrap'   ? 0.72 :
      genre === 'phonk'      ? 0.65 :
      genre === 'jerseyClub' ? 0.55 :
                               0.35; // ukDrill — sparser triplets

    // Section scaling: cold=rare, main=moderate, final=heavy
    const tripletChance = tripletBase *
      (section === 0 ? 0.30 : section === 1 ? 0.70 : section === 2 ? 0.50 : 1.0);

    if (rng() < tripletChance) {
      // Choose which beat(s) to tripletize — 1 to 3 beats per bar
      const beatCount = rng() < 0.5 ? 1 : rng() < 0.7 ? 2 : 3;
      const beats = [0, 1, 2, 3].sort(() => rng() - 0.5).slice(0, beatCount);

      for (const beat of beats) {
        const beatSlots = HAT_TRIPLETS.filter(s => s.pos >= beat * 4 && s.pos < beat * 4 + 4);
        for (const slot of beatSlots) {
          const absPos = slot.pos + offset;
          if (absPos >= totalTicks) continue;
          if (rng() < slot.prob) {
            const velVar = Math.round((rng() - 0.5) * 20);
            events.push({ position: absPos, lane: 'hat', pitch: DRUM_GM.hat,
              velocity: Math.max(28, Math.min(110, Math.round(slot.vel * velMult) + velVar)) });
          }
        }
      }
    }

    // Triplet kick roll — fire on final bar of sections 1 and 3 for drama
    if ((section === 1 || section === 3) && isTransitionBar && rng() < 0.65) {
      for (const slot of KICK_TRIPLETS) {
        const absPos = slot.pos + offset;
        if (absPos >= totalTicks) continue;
        if (rng() < slot.prob)
          events.push({ position: absPos, lane: 'kick', pitch: DRUM_GM.kick,
            velocity: Math.max(40, Math.min(110, Math.round(slot.vel + (rng() - 0.5) * 18))) });
      }
    }

    // Ghost snare — section 1 more frequent, section 0 rare
    const ghostChance = section === 0 ? 0.20 : section === 1 ? 0.45 : section === 2 ? 0.30 : 0.35;
    if (bar % 2 === 1 && rng() < ghostChance) {
      const ghostPos = offset + (rng() < 0.5 ? 5 : 13);
      if (ghostPos < totalTicks)
        events.push({ position: ghostPos, lane: 'snare', pitch: DRUM_GM.snare,
          velocity: Math.round(38 + rng() * 26) });
    }
  }

  return events.sort((a, b) => a.position - b.position || a.lane.localeCompare(b.lane));
}

