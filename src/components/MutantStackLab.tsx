import { useState, useCallback } from 'react';
import type { GeneratedPack, DrumLane, MidiEvent, DrumEvent } from '../types';

const GRID_COLS = 32;

const DRUM_GM: Record<DrumLane, number> = {
  kick: 36, snare: 38, clap: 39, hat: 42, openHat: 46,
};

const DRUM_LANES: DrumLane[] = ['kick', 'snare', 'clap', 'hat', 'openHat'];
type MelodicPadId = 'bass' | 'melody' | 'chords';
type PadId = DrumLane | MelodicPadId;

const PADS: Array<{ id: PadId; label: string; color: string; type: 'drum' | 'melodic' }> = [
  { id: 'kick',    label: 'KICK',     color: '#ff453a', type: 'drum' },
  { id: 'snare',   label: 'SNARE',    color: '#ff9f0a', type: 'drum' },
  { id: 'clap',    label: 'CLAP',     color: '#ffd60a', type: 'drum' },
  { id: 'hat',     label: 'HAT',      color: '#30d158', type: 'drum' },
  { id: 'openHat', label: 'OPEN HAT', color: '#66d4cf', type: 'drum' },
  { id: 'bass',    label: '808',      color: '#bf5af2', type: 'melodic' },
  { id: 'melody',  label: 'MELODY',   color: '#0a84ff', type: 'melodic' },
  { id: 'chords',  label: 'CHORDS',   color: '#5ac8fa', type: 'melodic' },
];

function isDrumLane(id: PadId): id is DrumLane {
  return DRUM_LANES.includes(id as DrumLane);
}

function getEvents(pack: GeneratedPack, id: PadId): Array<{ position: number; velocity: number }> {
  if (id === 'bass')   return pack.bass;
  if (id === 'melody') return pack.melody;
  if (id === 'chords') return pack.chords;
  return pack.drums.events.filter(e => e.lane === (id as DrumLane));
}

function StepGrid({ events, color, totalTicks, zoom, viewStart }: {
  events: Array<{ position: number; velocity: number }>;
  color: string;
  totalTicks: number;
  zoom: number;
  viewStart: number;
}) {
  // zoom < 1 = zoom OUT (see more bars); zoom > 1 = zoom IN (see fewer bars in more detail)
  const rawRange = totalTicks / zoom;
  const visRange = Math.min(rawRange, totalTicks - viewStart);
  const ticksPerCell = visRange / GRID_COLS;
  const viewEnd = viewStart + visRange;

  const cells: number[] = new Array(GRID_COLS).fill(0);
  for (const e of events) {
    if (e.position >= viewStart && e.position < viewEnd) {
      const col = Math.floor((e.position - viewStart) / ticksPerCell);
      if (col >= 0 && col < GRID_COLS)
        cells[col] = Math.max(cells[col], e.velocity / 127);
    }
  }

  // 8-bar section boundaries: mark the cell where each 8-bar block starts
  const section8Ticks = 8 * 16; // 128 ticks
  const sectionBoundaryCols = new Set<number>();
  for (let t = section8Ticks; t < totalTicks; t += section8Ticks) {
    if (t >= viewStart && t < viewEnd) {
      const col = Math.floor((t - viewStart) / ticksPerCell);
      if (col > 0 && col < GRID_COLS) sectionBoundaryCols.add(col);
    }
  }

  return (
    <div className="msl-step-grid">
      {cells.map((v, i) => (
        <div
          key={i}
          className={`msl-cell${sectionBoundaryCols.has(i) ? ' section-mark' : ''}`}
          style={v > 0 ? { background: color, opacity: 0.35 + v * 0.65 } : undefined}
        />
      ))}
    </div>
  );
}

export interface CropRange { start: number; end: number; }

interface Props {
  pack: GeneratedPack;
  crop: CropRange;
  onCropChange: (c: CropRange) => void;
  onPackPatch: (next: GeneratedPack) => void;
  showToast: (msg: string, type?: 'success' | 'error') => void;
}

export function MutantStackLab({ pack, crop, onCropChange, onPackPatch, showToast }: Props) {
  const [zoom, setZoom] = useState<0.25 | 0.5 | 1 | 2 | 4>(1);
  const [copySource, setCopySource] = useState<PadId | null>(null);

  const bars = pack.state.bars ?? 4;
  const totalTicks = bars * 16;
  const viewStart = crop.start * 16;

  const handlePadClick = useCallback((id: PadId) => {
    if (copySource === null) {
      setCopySource(id);
      return;
    }
    if (copySource === id) {
      setCopySource(null);
      return;
    }
    // Paste
    const srcId = copySource;
    setCopySource(null);
    const srcLabel = PADS.find(p => p.id === srcId)!.label;
    const dstLabel = PADS.find(p => p.id === id)!.label;

    if (isDrumLane(srcId) && isDrumLane(id)) {
      const srcEvents = pack.drums.events.filter(e => e.lane === srcId);
      const dstPitch = DRUM_GM[id];
      const pasted: DrumEvent[] = srcEvents.map(e => ({ ...e, lane: id, pitch: dstPitch }));
      const nextEvents = [...pack.drums.events.filter(e => e.lane !== id), ...pasted];
      onPackPatch({ ...pack, drums: { events: nextEvents } });
      showToast(`PASTED ${srcLabel} → ${dstLabel}`);
    } else if (!isDrumLane(srcId) && !isDrumLane(id)) {
      const srcEvents = getEvents(pack, srcId) as MidiEvent[];
      onPackPatch({ ...pack, [id]: [...srcEvents] });
      showToast(`PASTED ${srcLabel} → ${dstLabel}`);
    } else {
      showToast('PASTE: DRUM ↔ MELODIC NOT SUPPORTED', 'error');
    }
  }, [copySource, pack, onPackPatch, showToast]);

  const barNums = Array.from({ length: bars }, (_, i) => i + 1);

  return (
    <div className="section msl-section">
      <div className="msl-top-row">
        <div className="section-label">MUTANT STACK LAB</div>
        <div className="msl-zoom-group">
          <span className="msl-zoom-label">ZOOM</span>
          {([0.25, 0.5, 1, 2, 4] as const).map(z => {
            const label = z === 0.25 ? '¼' : z === 0.5 ? '½' : `${z}×`;
            return (
              <button key={z} className={`msl-zoom-btn${zoom === z ? ' active' : ''}`} onClick={() => setZoom(z)}>
                {label}
              </button>
            );
          })}
        </div>
      </div>

      <div className="msl-crop-row">
        <span className="msl-crop-label">CROP</span>
        <div className="msl-bar-pills">
          {barNums.map(b => {
            const inRange = b > crop.start && b <= crop.end;
            return (
              <button
                key={b}
                className={`msl-bar-pill${inRange ? ' in-range' : ''}`}
                onClick={() => {
                  if (b <= crop.start) {
                    onCropChange({ start: b - 1, end: Math.max(b, crop.end) });
                  } else if (b > crop.end) {
                    onCropChange({ start: crop.start, end: b });
                  } else if (b === crop.end && crop.end - crop.start > 1) {
                    onCropChange({ start: crop.start, end: b - 1 });
                  } else if (b === crop.start + 1 && b < crop.end) {
                    onCropChange({ start: b - 1, end: crop.end });
                  }
                }}
              >
                {b}
              </button>
            );
          })}
        </div>
        <button className="msl-crop-reset" onClick={() => onCropChange({ start: 0, end: bars })}>ALL</button>
      </div>

      {copySource && (
        <div className="msl-paste-banner">
          <span>COPY: {PADS.find(p => p.id === copySource)?.label} — TAP TARGET PAD TO PASTE</span>
          <button className="msl-cancel-copy" onClick={() => setCopySource(null)}>✕</button>
        </div>
      )}

      <div className="msl-pad-grid">
        {PADS.map(pad => {
          const events = getEvents(pack, pad.id);
          const croppedHits = events.filter(e => e.position >= crop.start * 16 && e.position < crop.end * 16).length;
          const isSource = copySource === pad.id;
          const isTarget = copySource !== null && copySource !== pad.id;

          return (
            <div
              key={pad.id}
              className={`msl-pad${isSource ? ' is-source' : ''}${isTarget ? ' is-target' : ''}`}
              style={{ '--pad-color': pad.color } as React.CSSProperties}
              onClick={() => handlePadClick(pad.id)}
            >
              <div className="msl-pad-top">
                <span className="msl-pad-name">{pad.label}</span>
                <span className="msl-pad-hits">{croppedHits}</span>
              </div>
              <StepGrid
                events={events}
                color={pad.color}
                totalTicks={totalTicks}
                zoom={zoom}
                viewStart={viewStart}
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
