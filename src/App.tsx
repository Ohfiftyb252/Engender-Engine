import { useState, useCallback, useRef } from 'react';
import type { EngineState, GeneratedPack, MutationTarget, Snapshot } from './types';
import { generateFresh, mutateVoice, recallFromSeed } from './engine/index';
import { measureSimilarity } from './engine/cloneShield';
import { buildZip, downloadZip } from './export/zip';
import { loadSnapshots, saveSnapshot, deleteSnapshot } from './storage/snapshots';
import { NOTE_NAMES } from './engine/scale';

const GENRES = ['darkTrap', 'ukDrill', 'phonk', 'jerseyClub'] as const;
const DNA_LIST = ['pressure', 'hypnotic', 'chaotic', 'ominous', 'paranoid', 'unstable', 'cinematic', 'emptyRoom'] as const;
const SCALES = ['harmonicMinor', 'phrygian', 'phrygianDominant', 'aeolian'] as const;

const SCALE_LABELS: Record<string, string> = {
  harmonicMinor: 'HARMONIC MINOR',
  phrygian: 'PHRYGIAN',
  phrygianDominant: 'PHRYGIAN DOMINANT',
  aeolian: 'AEOLIAN',
};

const GENRE_LABELS: Record<string, string> = {
  darkTrap: 'DARK TRAP',
  ukDrill: 'UK DRILL',
  phonk: 'PHONK',
  jerseyClub: 'JERSEY CLUB',
};

const DNA_LABELS: Record<string, string> = {
  pressure: 'PRESSURE',
  hypnotic: 'HYPNOTIC',
  chaotic: 'CHAOTIC',
  ominous: 'OMINOUS',
  paranoid: 'PARANOID',
  unstable: 'UNSTABLE',
  cinematic: 'CINEMATIC',
  emptyRoom: 'EMPTY ROOM',
};

function useToast() {
  const [toast, setToast] = useState<{ msg: string; type: 'success' | 'error' | '' } | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const showToast = useCallback((msg: string, type: 'success' | 'error' = 'success') => {
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({ msg, type });
    timerRef.current = setTimeout(() => setToast(null), 2200);
  }, []);

  return { toast, showToast };
}

export default function App() {
  const [pack, setPack] = useState<GeneratedPack | null>(null);
  const [prevPack, setPrevPack] = useState<GeneratedPack | null>(null);
  const [generating, setGenerating] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(loadSnapshots);
  const { toast, showToast } = useToast();

  // Controlled form state (pre-generation)
  const [genre, setGenre] = useState<EngineState['genre']>('darkTrap');
  const [dna, setDna] = useState<EngineState['dna']>('ominous');
  const [key, setKey] = useState(0);
  const [scale, setScale] = useState<EngineState['scale']>('harmonicMinor');
  const [bpm, setBpm] = useState(140);
  const [seedInput, setSeedInput] = useState('');

  // Tap tempo
  const tapTimesRef = useRef<number[]>([]);
  const handleTapTempo = useCallback(() => {
    const now = Date.now();
    tapTimesRef.current = [...tapTimesRef.current.filter(t => now - t < 3000), now];
    if (tapTimesRef.current.length >= 2) {
      const gaps = tapTimesRef.current.slice(1).map((t, i) => t - tapTimesRef.current[i]);
      const avgGap = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      const newBpm = Math.round(60000 / avgGap);
      setBpm(Math.max(60, Math.min(220, newBpm)));
    }
  }, []);

  const handleGenerate = useCallback(() => {
    setGenerating(true);
    setTimeout(() => {
      try {
        const parsedSeed = seedInput ? parseInt(seedInput, 16) || parseInt(seedInput, 10) : undefined;
        const newPack = generateFresh({ genre, dna, key, scale, bpm, seed: parsedSeed });

        // Clone shield check
        if (prevPack) {
          const sim = measureSimilarity(prevPack, newPack);
          if (sim.blocked) {
            showToast('CLONE DETECTED — REGENERATING', 'error');
            const regen = generateFresh({ genre, dna, key, scale, bpm });
            setPrevPack(newPack);
            setPack(regen);
            setGenerating(false);
            return;
          }
        }

        setPrevPack(pack);
        setPack(newPack);
      } catch (e) {
        showToast('ENGINE ERROR', 'error');
        console.error(e);
      }
      setGenerating(false);
    }, 10);
  }, [genre, dna, key, scale, bpm, seedInput, pack, prevPack, showToast]);

  const handleMutate = useCallback((target: MutationTarget) => {
    if (!pack) return;
    const mutated = mutateVoice(pack, target);
    setPrevPack(pack);
    setPack(mutated);
    showToast(`${target.toUpperCase()} MUTATED ⟶ ${mutated.fingerprint}`);
  }, [pack, showToast]);

  const handleExport = useCallback(async () => {
    if (!pack || exporting) return;
    setExporting(true);
    try {
      const blob = await buildZip(pack);
      downloadZip(blob, pack.fingerprint, pack.state.bpm);
      showToast(`EXPORTED EngenderEngine_${pack.fingerprint}_${pack.state.bpm}BPM.zip`);
    } catch (e) {
      showToast('EXPORT FAILED', 'error');
      console.error(e);
    }
    setExporting(false);
  }, [pack, exporting, showToast]);

  const handleSaveSnapshot = useCallback(() => {
    if (!pack) return;
    const snap = saveSnapshot(pack.state, pack.scores, pack.fingerprint);
    setSnapshots(loadSnapshots());
    showToast(`SAVED ${snap.fingerprint}`);
  }, [pack, showToast]);

  const handleRecallSnapshot = useCallback((snap: Snapshot) => {
    const recalled = recallFromSeed(snap.state);
    setPrevPack(pack);
    setPack(recalled);
    setGenre(snap.state.genre);
    setDna(snap.state.dna);
    setKey(snap.state.key);
    setScale(snap.state.scale);
    setBpm(snap.state.bpm);
    setSeedInput(snap.state.seed.toString(16).toUpperCase());
    showToast(`RECALLED ${snap.fingerprint}`);
  }, [pack, showToast]);

  const handleDeleteSnapshot = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    deleteSnapshot(id);
    setSnapshots(loadSnapshots());
  }, []);

  const handleRandomSeed = useCallback(() => {
    const s = Math.floor(Math.random() * 0xffffffff).toString(16).toUpperCase();
    setSeedInput(s);
  }, []);

  const scores = pack?.scores;
  const fingerprint = pack?.fingerprint ?? '------';
  const tree = pack?.state.mutationTree ?? [];

  return (
    <div className="app">
      {/* Toast */}
      {toast && (
        <div className={`toast ${toast ? 'visible' : ''} ${toast.type}`}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header className="header">
        <div className="header-logo">ENGENDER ENGINE™</div>
        <div className="header-fp">
          <span>ID</span>
          <span className="fp-badge">{fingerprint}</span>
        </div>
      </header>

      {/* Controls */}
      <div className="section">
        <div className="section-label">ENGINE PARAMETERS</div>
        <div className="controls-grid">
          <div className="control-group">
            <label className="control-label">GENRE</label>
            <select value={genre} onChange={e => setGenre(e.target.value as typeof genre)}>
              {GENRES.map(g => <option key={g} value={g}>{GENRE_LABELS[g]}</option>)}
            </select>
          </div>
          <div className="control-group">
            <label className="control-label">DNA</label>
            <select value={dna} onChange={e => setDna(e.target.value as typeof dna)}>
              {DNA_LIST.map(d => <option key={d} value={d}>{DNA_LABELS[d]}</option>)}
            </select>
          </div>
          <div className="control-group">
            <label className="control-label">KEY</label>
            <select value={key} onChange={e => setKey(Number(e.target.value))}>
              {NOTE_NAMES.map((n, i) => <option key={i} value={i}>{n}</option>)}
            </select>
          </div>
          <div className="control-group">
            <label className="control-label">SCALE</label>
            <select value={scale} onChange={e => setScale(e.target.value as typeof scale)}>
              {SCALES.map(s => <option key={s} value={s}>{SCALE_LABELS[s]}</option>)}
            </select>
          </div>
          <div className="control-group full-width">
            <label className="control-label">BPM</label>
            <div className="bpm-row">
              <input
                type="number"
                min={60}
                max={220}
                value={bpm}
                onChange={e => setBpm(Math.max(60, Math.min(220, Number(e.target.value))))}
              />
              <button className="bpm-tap" onClick={handleTapTempo}>TAP</button>
            </div>
          </div>
          <div className="control-group full-width">
            <label className="control-label">SEED (HEX or decimal, blank = random)</label>
            <div className="seed-row">
              <input
                type="text"
                placeholder="RANDOM"
                value={seedInput}
                onChange={e => setSeedInput(e.target.value)}
                maxLength={16}
              />
              <button className="seed-randomize" onClick={handleRandomSeed} title="Randomize seed">↺</button>
            </div>
          </div>
        </div>
      </div>

      {/* Generate */}
      <div className="generate-section">
        <button
          className={`btn-generate${generating ? ' generating' : ''}`}
          onClick={handleGenerate}
          disabled={generating}
        >
          {generating ? 'GENERATING…' : '▶ GENERATE SKELETON'}
        </button>
      </div>

      {/* Telemetry */}
      {scores && (
        <div className="section">
          <div className="section-label">TELEMETRY</div>
          <div className="telemetry-grid">
            {(['bounce', 'pocket', 'darkness'] as const).map(k => (
              <div key={k} className="telemetry-card">
                <div className="tel-name">{k.toUpperCase()}</div>
                <div className={`tel-value ${k}`}>{scores[k]}</div>
                <div className="tel-bar">
                  <div className={`tel-bar-fill ${k}`} style={{ width: `${scores[k]}%` }} />
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Mutation */}
      {pack && (
        <div className="section">
          <div className="section-label">MUTATION ENGINE</div>
          <div className="mutation-btns">
            {(['melody', 'chords', 'bass'] as const).map(t => (
              <button key={t} className={`btn-mutate ${t}`} onClick={() => handleMutate(t)}>
                MUTATE {t.toUpperCase()}
              </button>
            ))}
          </div>
          {tree.length > 0 && (
            <div className="mutation-tree">
              {tree.map(node => (
                <span
                  key={node.id}
                  className={`mutation-node ${node.target}${
                    node.id === pack.state.activeNodeId ? ' active' : ''
                  }`}
                >
                  {node.id}
                </span>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Snapshots */}
      <div className="section">
        <div className="section-label">SNAPSHOTS</div>
        <div className="snapshot-actions">
          <button
            className="btn-save-snap"
            onClick={handleSaveSnapshot}
            disabled={!pack}
          >
            + SAVE SNAPSHOT
          </button>
        </div>
        <div className="snapshots-list">
          {snapshots.length === 0 ? (
            <div className="empty-state">NO SNAPSHOTS SAVED</div>
          ) : (
            snapshots.map(snap => (
              <div key={snap.id} className="snapshot-card" onClick={() => handleRecallSnapshot(snap)}>
                <div className="snap-left">
                  <div className="snap-label">{snap.label}</div>
                  <div className="snap-meta">
                    {GENRE_LABELS[snap.state.genre]} • {snap.state.bpm} BPM • DEPTH {snap.state.mutationDepth}
                  </div>
                </div>
                <div className="snap-scores">
                  <span className="snap-score b">B{snap.scores.bounce}</span>
                  <span className="snap-score p">P{snap.scores.pocket}</span>
                  <span className="snap-score d">D{snap.scores.darkness}</span>
                </div>
                <button
                  className="snap-delete"
                  onClick={e => handleDeleteSnapshot(snap.id, e)}
                  title="Delete snapshot"
                >
                  ×
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Export bar */}
      <div className="export-bar">
        <button
          className={`btn-export${exporting ? ' exporting' : ''}`}
          onClick={handleExport}
          disabled={!pack || exporting}
        >
          <span>{exporting ? '⧗ BUILDING ZIP…' : '⤓ EXPORT MIDI PACK'}</span>
          {pack && <span style={{ opacity: 0.5, fontSize: '9px', letterSpacing: '0.1em' }}>3 MIDI + MANIFEST</span>}
        </button>
      </div>
    </div>
  );
}
