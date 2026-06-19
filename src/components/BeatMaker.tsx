import { useState, useEffect, useCallback, useRef } from 'react';
import type { GeneratedPack, Step, BeatPattern, PadId, PatternId } from '../types';

// ─── Constants ───────────────────────────────────────────────────────────────

const PAD_DEFS: Array<{ id: PadId; label: string; color: string; shortLabel: string }> = [
  { id: 'kick',    label: 'KICK',   color: '#ff453a', shortLabel: 'K' },
  { id: 'snare',   label: 'SNARE',  color: '#ff9f0a', shortLabel: 'S' },
  { id: 'clap',    label: 'CLAP',   color: '#ffd60a', shortLabel: 'C' },
  { id: 'hat',     label: 'HAT',    color: '#30d158', shortLabel: 'H' },
  { id: 'openHat', label: 'OPEN',   color: '#66d4cf', shortLabel: 'O' },
  { id: 'bass',    label: '808',    color: '#bf5af2', shortLabel: 'B' },
  { id: 'melody',  label: 'MELODY', color: '#0a84ff', shortLabel: 'M' },
  { id: 'chords',  label: 'CHORDS', color: '#5ac8fa', shortLabel: 'C' },
];

const DRUM_GM: Record<string, number> = {
  kick: 36,
  snare: 38,
  clap: 39,
  hat: 42,
  openHat: 46,
};

const PATTERN_IDS: PatternId[] = ['A', 'B', 'C', 'D'];

// ─── Helpers ─────────────────────────────────────────────────────────────────

function makeEmptySteps(): Step[] {
  return Array.from({ length: 16 }, () => ({ active: false, velocity: 100, pitch: 60 }));
}

export function emptyPattern(): BeatPattern {
  return {
    kick:    makeEmptySteps(),
    snare:   makeEmptySteps(),
    clap:    makeEmptySteps(),
    hat:     makeEmptySteps(),
    openHat: makeEmptySteps(),
    bass:    makeEmptySteps(),
    melody:  makeEmptySteps(),
    chords:  makeEmptySteps(),
  };
}

export function packToBeatPattern(pack: GeneratedPack): BeatPattern {
  const pattern = emptyPattern();

  // Drum lanes
  const drumLanes: Array<'kick' | 'snare' | 'clap' | 'hat' | 'openHat'> = [
    'kick', 'snare', 'clap', 'hat', 'openHat',
  ];
  for (const lane of drumLanes) {
    const events = pack.drums.events.filter(e => e.lane === lane);
    for (const e of events) {
      const step = Math.round(e.position) % 16;
      const existing = pattern[lane][step];
      if (!existing.active || e.velocity > existing.velocity) {
        pattern[lane][step] = {
          active: true,
          velocity: e.velocity,
          pitch: DRUM_GM[lane] ?? 60,
        };
      }
    }
  }

  // Bass
  for (const e of pack.bass) {
    const step = Math.round(e.position) % 16;
    if (!pattern.bass[step].active) {
      pattern.bass[step] = { active: true, velocity: e.velocity, pitch: e.pitch };
    }
  }

  // Melody
  for (const e of pack.melody) {
    const step = Math.round(e.position) % 16;
    if (!pattern.melody[step].active) {
      pattern.melody[step] = { active: true, velocity: e.velocity, pitch: e.pitch };
    }
  }

  // Chords
  for (const e of pack.chords) {
    const step = Math.round(e.position) % 16;
    if (!pattern.chords[step].active) {
      pattern.chords[step] = { active: true, velocity: e.velocity, pitch: e.pitch };
    }
  }

  return pattern;
}

// ─── Props ───────────────────────────────────────────────────────────────────

export interface BeatMakerProps {
  pack: GeneratedPack | null;
  playing: boolean;
  currentStep: number;
  swing: number;
  onSwingChange: (v: number) => void;
  onPatternChange: (pattern: BeatPattern) => void;
  onPadTrigger: (padId: PadId, velocity: number, pitch: number) => void;
}

// ─── Component ───────────────────────────────────────────────────────────────

export function BeatMaker(props: BeatMakerProps) {
  const { pack, playing, currentStep, swing, onSwingChange, onPatternChange, onPadTrigger } = props;

  const [patterns, setPatterns] = useState<Record<PatternId, BeatPattern>>({
    A: emptyPattern(),
    B: emptyPattern(),
    C: emptyPattern(),
    D: emptyPattern(),
  });
  const [activePattern, setActivePattern] = useState<PatternId>('A');
  const [selectedPad, setSelectedPad] = useState<PadId>('kick');
  const [flashPads, setFlashPads] = useState<Set<PadId>>(new Set());

  // Stable ref so flash timeout can access latest state
  const flashTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // When pack changes, convert to beat pattern and put into slot A
  useEffect(() => {
    if (!pack) return;
    const newPat = packToBeatPattern(pack);
    setPatterns(prev => {
      const next = { ...prev, A: newPat };
      return next;
    });
    onPatternChange(newPat);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pack]);

  // When active pattern changes, notify parent
  // (also fires on pattern content changes via the update helpers below which
  //  call onPatternChange directly — this covers pattern-bank switching)
  const handlePatternSwitch = useCallback((p: PatternId) => {
    setActivePattern(p);
    // Use functional update to get latest patterns
    setPatterns(prev => {
      onPatternChange(prev[p]);
      return prev;
    });
  }, [onPatternChange]);

  // Flash pads that fire on the current step
  useEffect(() => {
    if (!playing || currentStep < 0) return;
    const pat = patterns[activePattern];
    const firing = new Set<PadId>();
    for (const pad of PAD_DEFS) {
      if (pat[pad.id][currentStep]?.active) {
        firing.add(pad.id);
      }
    }
    if (firing.size === 0) return;
    setFlashPads(firing);
    if (flashTimerRef.current) clearTimeout(flashTimerRef.current);
    flashTimerRef.current = setTimeout(() => setFlashPads(new Set()), 80);
  }, [currentStep, playing, patterns, activePattern]);

  // ── Step toggle ────────────────────────────────────────────────────────────
  const toggleStep = useCallback((stepIndex: number) => {
    setPatterns(prev => {
      const steps = [...prev[activePattern][selectedPad]];
      steps[stepIndex] = { ...steps[stepIndex], active: !steps[stepIndex].active };
      const next = {
        ...prev,
        [activePattern]: { ...prev[activePattern], [selectedPad]: steps },
      };
      onPatternChange(next[activePattern]);
      return next;
    });
  }, [activePattern, selectedPad, onPatternChange]);

  // ── Clear selected pad ─────────────────────────────────────────────────────
  const handleClear = useCallback(() => {
    setPatterns(prev => {
      const next = {
        ...prev,
        [activePattern]: {
          ...prev[activePattern],
          [selectedPad]: makeEmptySteps(),
        },
      };
      onPatternChange(next[activePattern]);
      return next;
    });
  }, [activePattern, selectedPad, onPatternChange]);

  // ── Fill every 4th step ────────────────────────────────────────────────────
  const handleFill = useCallback(() => {
    setPatterns(prev => {
      const steps = prev[activePattern][selectedPad].map((s, i) =>
        i % 4 === 0 ? { ...s, active: true } : s
      );
      const next = {
        ...prev,
        [activePattern]: { ...prev[activePattern], [selectedPad]: steps },
      };
      onPatternChange(next[activePattern]);
      return next;
    });
  }, [activePattern, selectedPad, onPatternChange]);

  const currentPat = patterns[activePattern];
  const selectedPadDef = PAD_DEFS.find(p => p.id === selectedPad)!;

  return (
    <div className="bm-root">

      {/* Row 1: Pattern bank + swing */}
      <div className="bm-top-bar">
        <div className="bm-pattern-group">
          <span className="bm-section-label">PATTERN</span>
          {PATTERN_IDS.map(p => (
            <button
              key={p}
              className={`bm-pat-btn${activePattern === p ? ' active' : ''}`}
              onClick={() => handlePatternSwitch(p)}
            >
              {p}
            </button>
          ))}
        </div>
        <div className="bm-swing-group">
          <span className="bm-section-label">SWING</span>
          <input
            type="range"
            min={0}
            max={0.5}
            step={0.01}
            value={swing}
            onChange={e => onSwingChange(Number(e.target.value))}
          />
          <span className="bm-swing-val">{Math.round(swing * 200)}%</span>
        </div>
      </div>

      {/* Row 2: 4×2 pad grid */}
      <div className="bm-pad-grid">
        {PAD_DEFS.map(pad => {
          const activeCount = currentPat[pad.id].filter(s => s.active).length;
          const isSelected = selectedPad === pad.id;
          const isFlashing = flashPads.has(pad.id);
          return (
            <button
              key={pad.id}
              className={`bm-pad${isSelected ? ' selected' : ''}${isFlashing ? ' flash' : ''}`}
              style={{ '--c': pad.color } as React.CSSProperties}
              onPointerDown={() => {
                setSelectedPad(pad.id);
                const firstActive = currentPat[pad.id].find(s => s.active);
                onPadTrigger(pad.id, firstActive?.velocity ?? 100, firstActive?.pitch ?? 60);
              }}
            >
              <span className="bm-pad-label">{pad.label}</span>
              <span className="bm-pad-count">{activeCount}</span>
            </button>
          );
        })}
      </div>

      {/* Row 3: Step sequencer for selected pad */}
      <div className="bm-seq-section">
        <div className="bm-seq-header">
          <span className="bm-seq-pad-name" style={{ color: selectedPadDef.color }}>
            {selectedPadDef.label}
          </span>
          <span className="bm-seq-label">&middot; STEPS</span>
          <button className="bm-clear-btn" onClick={handleClear}>CLEAR</button>
          <button className="bm-fill-btn" onClick={handleFill}>4-ON</button>
        </div>
        <div className="bm-steps">
          {currentPat[selectedPad].map((step, i) => (
            <button
              key={i}
              className={`bm-step${step.active ? ' on' : ''}${currentStep === i && playing ? ' cur' : ''}${i % 4 === 0 ? ' beat' : ''}`}
              style={step.active
                ? ({
                    '--c': selectedPadDef.color,
                    '--v': step.velocity / 127,
                  } as React.CSSProperties)
                : undefined
              }
              onClick={() => toggleStep(i)}
            />
          ))}
        </div>
      </div>

    </div>
  );
}
