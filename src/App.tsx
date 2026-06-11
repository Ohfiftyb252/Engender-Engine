import { useState, useCallback, useRef, useEffect } from 'react';
import { EnginePlayer, bounceToWav, renderToWav, wavFilename } from './audio/player';
import type { EngineState, GeneratedPack, MutationTarget, Snapshot, PackValidationResult } from './types';
import { generateFresh, mutateVoice, recallFromSeed } from './engine/index';
import { measureSimilarity } from './engine/cloneShield';
import { validatePocketPack, repairWeakLanes } from './engine/validatePack';
import { buildZip, downloadZip } from './export/zip';
import { loadSnapshots, saveSnapshot, deleteSnapshot } from './storage/snapshots';
import { NOTE_NAMES, validateScaleNotes } from './engine/scale';

const GENRES = ['darkTrap', 'ukDrill', 'phonk', 'jerseyClub'] as const;
const DNA_LIST = ['pressure', 'hypnotic', 'chaotic', 'ominous', 'paranoid', 'unstable', 'cinematic', 'emptyRoom'] as const;
const SCALES = ['harmonicMinor', 'phrygian', 'phrygianDominant', 'aeolian'] as const;

const SCALE_LABELS: Record<string, string> = { harmonicMinor: 'HARMONIC MINOR', phrygian: 'PHRYGIAN', phrygianDominant: 'PHRYGIAN DOMINANT', aeolian: 'AEOLIAN' };
const GENRE_LABELS: Record<string, string> = { darkTrap: 'DARK TRAP', ukDrill: 'UK DRILL', phonk: 'PHONK', jerseyClub: 'JERSEY CLUB' };
const DNA_LABELS: Record<string, string> = { pressure: 'PRESSURE', hypnotic: 'HYPNOTIC', chaotic: 'CHAOTIC', ominous: 'OMINOUS', paranoid: 'PARANOID', unstable: 'UNSTABLE', cinematic: 'CINEMATIC', emptyRoom: 'EMPTY ROOM' };

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
  const [bouncing, setBouncing] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [validation, setValidation] = useState<PackValidationResult | null>(null);
  const [snapshots, setSnapshots] = useState<Snapshot[]>(loadSnapshots);
  const { toast, showToast } = useToast();
  const [genre, setGenre] = useState<EngineState['genre']>('darkTrap');
  const [dna, setDna] = useState<EngineState['dna']>('ominous');
  const [key, setKey] = useState(0);
  const [scale, setScale] = useState<EngineState['scale']>('harmonicMinor');
  const [bpm, setBpm] = useState(140);
  const [bars, setBars] = useState(4);
  const [loopMode, setLoopMode] = useState<1 | 2 | 4>(1);
  const [seedInput, setSeedInput] = useState('');
  const [playing, setPlaying] = useState(false);
  const [audioLoading, setAudioLoading] = useState(false);
  const [mutedVoices, setMutedVoices] = useState<Set<MutationTarget>>(new Set());
  const [isStale, setIsStale] = useState(false);
  const playerRef = useRef<EnginePlayer>(new EnginePlayer());
  const tapTimesRef = useRef<number[]>([]);

  // Stop playback when pack changes
  useEffect(() => {
    const player = playerRef.current;
    if (player.playing) {
      player.stop();
      setPlaying(false);
    }
  }, [pack]);

  // Dispose audio engine on unmount
  useEffect(() => {
    const player = playerRef.current;
    return () => { player.dispose(); };
  }, []);

  // Stale detection — compares live UI params against the canonical generated state
  useEffect(() => {
    if (!pack) { setIsStale(false); return; }
    const rawSeed = seedInput.trim();
    const parsedSeed = rawSeed
      ? (parseInt(rawSeed, 16) || parseInt(rawSeed, 10))
      : undefined;
    const seedDiffers = parsedSeed !== pack.state.seed;
    const stale =
      genre !== pack.state.genre ||
      dna !== pack.state.dna ||
      key !== pack.state.key ||
      scale !== pack.state.scale ||
      bpm !== pack.state.bpm ||
      bars !== (pack.state.bars ?? 4) ||
      seedDiffers;
    setIsStale(stale);
  }, [pack, genre, dna, key, scale, bpm, bars, seedInput]);

  const handlePlayStop = useCallback(async () => {
    const player = playerRef.current;
    if (playing) {
      player.stop();
      setPlaying(false);
    } else {
      if (!pack) return;
      setAudioLoading(true);
      setMutedVoices(new Set());
      try {
        await player.load(pack);
        player.play();
        setPlaying(true);
      } catch (e) {
        showToast('AUDIO ERROR', 'error');
        console.error(e);
      }
      setAudioLoading(false);
    }
  }, [playing, pack, showToast]);

  const handleMuteToggle = useCallback((voice: MutationTarget) => {
    playerRef.current.toggleMute(voice);
    setMutedVoices(prev => {
      const next = new Set(prev);
      if (next.has(voice)) next.delete(voice);
      else next.add(voice);
      return next;
    });
  }, []);

  const handleTapTempo = useCallback(() => {
    const now = Date.now();
    tapTimesRef.current = [...tapTimesRef.current.filter(t => now - t < 3000), now];
    if (tapTimesRef.current.length >= 2) {
      const gaps = tapTimesRef.current.slice(1).map((t, i) => t - tapTimesRef.current[i]);
      setBpm(Math.max(60, Math.min(220, Math.round(60000 / (gaps.reduce((a, b) => a + b, 0) / gaps.length)))));
    }
  }, []);

  const handleGenerate = useCallback(() => {
    setGenerating(true);
    setTimeout(() => {
      try {
        const parsedSeed = seedInput ? (parseInt(seedInput, 16) || parseInt(seedInput, 10)) : undefined;
        const newPack = generateFresh({ genre, dna, key, scale, bpm, bars, seed: parsedSeed });
        if (prevPack) {
          const sim = measureSimilarity(prevPack, newPack);
          if (sim.blocked) {
            showToast('CLONE DETECTED — REGENERATING', 'error');
            const regen = generateFresh({ genre, dna, key, scale, bpm, bars });
            setSeedInput(regen.state.seed.toString(16).toUpperCase());
            setValidation(validatePocketPack(regen));
            setPrevPack(newPack); setPack(regen); setGenerating(false); return;
          }
        }
        setSeedInput(newPack.state.seed.toString(16).toUpperCase());
        setPrevPack(pack); setPack(newPack);
        setValidation(validatePocketPack(newPack));
      } catch (e) { showToast('ENGINE ERROR', 'error'); console.error(e); }
      setGenerating(false);
    }, 10);
  }, [genre, dna, key, scale, bpm, bars, seedInput, pack, prevPack, showToast]);

  const handleMutate = useCallback((target: MutationTarget) => {
    if (!pack) return;
    const mutated = mutateVoice(pack, target);
    setPrevPack(pack); setPack(mutated);
    setValidation(validatePocketPack(mutated));
    showToast(`${target.toUpperCase()} MUTATED ⟶ ${mutated.fingerprint}`);
  }, [pack, showToast]);

  const handleRepair = useCallback(async () => {
    if (!pack || repairing) return;
    setRepairing(true);
    try {
      const repaired = repairWeakLanes(pack);
      setPrevPack(pack); setPack(repaired);
      const result = validatePocketPack(repaired);
      setValidation(result);
      showToast(result.valid ? `REPAIRED ⟶ ${repaired.fingerprint}` : 'REPAIR PARTIAL — STILL WEAK', result.valid ? 'success' : 'error');
    } catch (e) { showToast('REPAIR FAILED', 'error'); console.error(e); }
    setRepairing(false);
  }, [pack, repairing, showToast]);

  const handleExport = useCallback(async () => {
    if (!pack || exporting) return;
    setExporting(true);
    try {
      const previewWavBuf = await renderToWav(pack, 1);
      const previewWav = new Uint8Array(previewWavBuf);
      const blob = await buildZip(pack, loopMode, previewWav);
      downloadZip(blob, pack.fingerprint, pack.state.bpm, pack.state.bars ?? 4);
      showToast(`POCKET PACK READY ⟶ ${pack.fingerprint}`);
    } catch (e) { showToast('EXPORT FAILED', 'error'); console.error(e); }
    setExporting(false);
  }, [pack, exporting, loopMode, showToast]);

  const handleBounce = useCallback(async () => {
    if (!pack || bouncing) return;
    setBouncing(true);
    try {
      await bounceToWav(pack, loopMode);
      showToast(`BOUNCED EngenderEngine_${pack.fingerprint}_${pack.state.bpm}BPM_${loopMode}x.wav`);
    } catch (e) { showToast('BOUNCE FAILED', 'error'); console.error(e); }
    setBouncing(false);
  }, [pack, bouncing, loopMode, showToast]);

  const handleSaveSnapshot = useCallback(() => {
    if (!pack) return;
    const snap = saveSnapshot(pack.state, pack.scores, pack.fingerprint);
    setSnapshots(loadSnapshots()); showToast(`SAVED ${snap.fingerprint}`);
  }, [pack, showToast]);

  const handleRecallSnapshot = useCallback((snap: Snapshot) => {
    const recalled = recallFromSeed(snap.state);
    setPrevPack(pack); setPack(recalled);
    setValidation(validatePocketPack(recalled));
    setGenre(snap.state.genre); setDna(snap.state.dna); setKey(snap.state.key);
    setScale(snap.state.scale); setBpm(snap.state.bpm); setBars(snap.state.bars ?? 4);
    setSeedInput(snap.state.seed.toString(16).toUpperCase());
    showToast(`RECALLED ${snap.fingerprint}`);
  }, [pack, showToast]);

  const handleDeleteSnapshot = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation(); deleteSnapshot(id); setSnapshots(loadSnapshots());
  }, []);

  const scores = pack?.scores;
  const fingerprint = pack?.fingerprint ?? '------';
  const tree = pack?.state.mutationTree ?? [];
  const scaleValidation = pack ? validateScaleNotes(pack.melody, pack.state.key, pack.state.scale) : null;

  return (
    <div className="app">
      {toast && <div className={`toast visible ${toast.type}`}>{toast.msg}</div>}
      <header className="header">
        <div className="header-logo">ENGENDER ENGINE™</div>
        <div className="header-fp"><span>ID</span><span className="fp-badge">{fingerprint}</span></div>
      </header>
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
          <div className="control-group">
            <label className="control-label">BPM</label>
            <div className="bpm-row">
              <input type="number" min={60} max={220} value={bpm} onChange={e => setBpm(Math.max(60, Math.min(220, Number(e.target.value))))} />
              <button className="bpm-tap" onClick={handleTapTempo}>TAP</button>
            </div>
          </div>
          <div className="control-group">
            <label className="control-label">BARS</label>
            <select value={bars} onChange={e => setBars(Number(e.target.value))}>
              <option value={4}>4 BARS</option>
              <option value={5}>5 BARS (EXP)</option>
            </select>
          </div>
          <div className="control-group full-width">
            <label className="control-label">SEED (HEX or decimal — blank = random)</label>
            <div className="seed-row">
              <input type="text" placeholder="RANDOM" value={seedInput} onChange={e => setSeedInput(e.target.value)} maxLength={16} />
              <button className="seed-randomize" onClick={() => setSeedInput(Math.floor(Math.random() * 0xffffffff).toString(16).toUpperCase())} title="Randomize">↺</button>
            </div>
          </div>
        </div>
      </div>
      <div className="generate-section">
        <div className="gen-play-row">
          <button className={`btn-generate${generating ? ' generating' : ''}`} onClick={handleGenerate} disabled={generating}>
            {generating ? 'GENERATING…' : '▶ GENERATE'}
          </button>
          {pack && (
            <button
              className={`btn-play-inline${playing ? ' playing' : ''}`}
              onClick={handlePlayStop}
              disabled={audioLoading}
              title={playing ? 'Stop' : 'Play preview'}
            >
              {audioLoading ? '⧗' : playing ? '■' : '▶'}
            </button>
          )}
        </div>
        {pack && (
          <div className="voice-mutes">
            {(['chords', 'melody', 'bass', 'drums'] as const).map(voice => (
              <button
                key={voice}
                className={`btn-mute ${mutedVoices.has(voice) ? 'muted' : `active-${voice}`}`}
                onClick={() => handleMuteToggle(voice)}
              >
                {voice.toUpperCase()}
              </button>
            ))}
          </div>
        )}
      </div>
      {scores && (
        <div className="section">
          <div className="section-label">TELEMETRY</div>
          <div className="telemetry-grid">
            {(['bounce', 'pocket', 'darkness'] as const).map(k => (
              <div key={k} className="telemetry-card">
                <div className="tel-name">{k.toUpperCase()}</div>
                <div className={`tel-value ${k}`}>{scores[k]}</div>
                <div className="tel-bar"><div className={`tel-bar-fill ${k}`} style={{ width: `${scores[k]}%` }} /></div>
              </div>
            ))}
          </div>
          {scaleValidation && scaleValidation.passingTones > 0 && (
            <div className="scale-validation">
              <span className="scale-val-label">SCALE CHECK</span>
              <span className="scale-val-result">
                {scaleValidation.inScale}/{scaleValidation.total} IN SCALE
                {' • '}{scaleValidation.passingTones} PASSING TONE{scaleValidation.passingTones !== 1 ? 'S' : ''}
              </span>
            </div>
          )}
          {validation && (
            <div className={`pack-validation ${validation.valid ? 'valid' : 'invalid'}`}>
              <span className="pack-val-label">{validation.valid ? '✓ VALID PACK' : '⚠ NEEDS REPAIR'}</span>
              {!validation.valid && validation.issues.length > 0 && (
                <ul className="pack-val-issues">
                  {validation.issues.map((issue, i) => <li key={i}>{issue}</li>)}
                </ul>
              )}
              {!validation.valid && (
                <button className="btn-repair" onClick={handleRepair} disabled={repairing}>
                  {repairing ? '⧗ REPAIRING…' : '⟳ REPAIR WEAK LANES'}
                </button>
              )}
            </div>
          )}
        </div>
      )}
      {pack && (
        <div className="section">
          <div className="section-label">MUTATION ENGINE</div>
          <div className="mutation-btns">
            {(['melody', 'chords', 'bass', 'drums'] as const).map(t => (
              <button key={t} className={`btn-mutate ${t}`} onClick={() => handleMutate(t)}>MUTATE {t.toUpperCase()}</button>
            ))}
          </div>
          {tree.length > 0 && (
            <div className="mutation-tree">
              {tree.map(node => (
                <span key={node.id} className={`mutation-node ${node.target}${node.id === pack.state.activeNodeId ? ' active' : ''}`}>{node.id}</span>
              ))}
            </div>
          )}
        </div>
      )}
      <div className="section">
        <div className="section-label">SNAPSHOTS</div>
        <div className="snapshot-actions">
          <button className="btn-save-snap" onClick={handleSaveSnapshot} disabled={!pack}>+ SAVE SNAPSHOT</button>
        </div>
        <div className="snapshots-list">
          {snapshots.length === 0 ? (
            <div className="empty-state">NO SNAPSHOTS SAVED</div>
          ) : snapshots.map(snap => (
            <div key={snap.id} className="snapshot-card" onClick={() => handleRecallSnapshot(snap)}>
              <div className="snap-left">
                <div className="snap-label">{snap.label}</div>
                <div className="snap-meta">{GENRE_LABELS[snap.state.genre]} • {snap.state.bpm} BPM • DEPTH {snap.state.mutationDepth}</div>
              </div>
              <div className="snap-scores">
                <span className="snap-score b">B{snap.scores.bounce}</span>
                <span className="snap-score p">P{snap.scores.pocket}</span>
                <span className="snap-score d">D{snap.scores.darkness}</span>
              </div>
              <button className="snap-delete" onClick={e => handleDeleteSnapshot(snap.id, e)} title="Delete">×</button>
            </div>
          ))}
        </div>
      </div>
      <div className="section export-section">
        <div className="section-label">EXPORT</div>
        {!pack && <div className="empty-state">GENERATE A PACK TO UNLOCK EXPORT</div>}
        {pack && (
          <>
            <div className="control-group export-loop-control">
              <label className="control-label">WAV LOOP MODE</label>
              <select value={loopMode} onChange={e => setLoopMode(Number(e.target.value) as 1 | 2 | 4)}>
                <option value={1}>1× — {bars} BARS</option>
                <option value={2}>2× — {bars * 2} BARS</option>
                <option value={4}>4× — {bars * 4} BARS</option>
              </select>
            </div>
            {isStale && (
              <div className="stale-warning">⚠ SETTINGS CHANGED — REGENERATE BEFORE EXPORT</div>
            )}
            <div className="export-btns">
              <button
                className={`btn-export-midi${exporting ? ' exporting' : ''}`}
                onClick={handleExport}
                disabled={exporting || isStale}
              >
                <span>{exporting ? '⧗ BUILDING ZIP…' : '⤓ DOWNLOAD POCKET PACK'}</span>
                <span className="export-sub">4 MIDI + WAV + MANIFEST</span>
              </button>
              <button
                className={`btn-bounce${bouncing ? ' bouncing' : ''}`}
                onClick={handleBounce}
                disabled={bouncing || isStale}
              >
                <span>{bouncing ? '⧗ BOUNCING…' : '◎ BOUNCE TO WAV'}</span>
                <span className="export-sub">{wavFilename(pack, loopMode)}</span>
              </button>
            </div>
          </>
        )}
      </div>
      <div style={{ height: '32px' }} />
    </div>
  );
}
