import { useState, useCallback, useRef, useEffect } from 'react';
import { EnginePlayer, bounceToWav, renderToWav, renderMelodyStem, wavFilename } from './audio/player';
import type { EngineState, GeneratedPack, MutationTarget, Snapshot, PackValidationResult, BeatPattern, PadId } from './types';
import { generateFresh, mutateVoice, recallFromSeed, mutateVoiceWithDimension } from './engine/index';
import { measureSimilarity } from './engine/cloneShield';
import { validatePocketPack, repairWeakLanes, repairLane } from './engine/validatePack';
import { buildZip, downloadZip } from './export/zip';
import { loadSnapshots, saveSnapshot, deleteSnapshot, duplicateSnapshot, branchFromSnapshot } from './storage/snapshots';
import { NOTE_NAMES, validateScaleNotes } from './engine/scale';
import { APP_VERSION } from './engine/fingerprint';
import { BeatMaker, packToBeatPattern, emptyPattern } from './components/BeatMaker';
import type { MutationDimension } from './types';

const GENRES = ['darkTrap', 'ukDrill', 'phonk', 'jerseyClub'] as const;
const DNA_LIST = ['pressure', 'hypnotic', 'chaotic', 'ominous', 'paranoid', 'unstable', 'cinematic', 'emptyRoom'] as const;
const SCALES = [
  // Major family (FL Mobile order)
  'majorBebop', 'majorBulgarian', 'majorPentatonic', 'majorPersian', 'majorPolymode',
  'lydian', 'mixolydian', 'phrygianDominant',
  // Minor family
  'harmonicMinor', 'minorHungarian', 'minorMelodic', 'minorNatural', 'minorNeapolitan',
  'minorPentatonic', 'minorPolymode', 'minorRomanian',
  // Modes
  'dorian', 'phrygian', 'aeolian', 'locrian',
  // World / special
  'chromatic', 'arabic', 'blues', 'diminished', 'dominantBebop',
  'egyptian', 'enigmatic', 'hirajoshi', 'iwato', 'japaneseInsen', 'locrianSuper',
] as const;

const SCALE_LABELS: Record<string, string> = {
  // Existing
  harmonicMinor:    'HARMONIC MINOR',
  phrygian:         'PHRYGIAN',
  phrygianDominant: 'PHRYGIAN DOMINANT',
  aeolian:          'AEOLIAN',
  // Major family
  majorBebop:       'MAJOR BEBOP',
  majorBulgarian:   'MAJOR BULGARIAN',
  majorPentatonic:  'MAJOR PENTATONIC',
  majorPersian:     'MAJOR PERSIAN',
  majorPolymode:    'MAJOR POLYMODE',
  lydian:           'LYDIAN',
  mixolydian:       'MIXOLYDIAN',
  // Minor family
  minorHungarian:   'MINOR HUNGARIAN',
  minorMelodic:     'MINOR MELODIC',
  minorNatural:     'MINOR NATURAL',
  minorNeapolitan:  'MINOR NEAPOLITAN',
  minorPentatonic:  'MINOR PENTATONIC',
  minorPolymode:    'MINOR POLYMODE',
  minorRomanian:    'MINOR ROMANIAN',
  dorian:           'DORIAN',
  locrian:          'LOCRIAN',
  // World / special
  chromatic:        'CHROMATIC',
  arabic:           'ARABIC',
  blues:            'BLUES',
  diminished:       'DIMINISHED',
  dominantBebop:    'DOMINANT BEBOP',
  egyptian:         'EGYPTIAN',
  enigmatic:        'ENIGMATIC',
  hirajoshi:        'HIRAJOSHI',
  iwato:            'IWATO',
  japaneseInsen:    'JAPANESE INSEN',
  locrianSuper:     'LOCRIAN SUPER',
};
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
  const [repairReport, setRepairReport] = useState<string[]>([]);
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
  const [beatPattern, setBeatPattern] = useState<BeatPattern>(emptyPattern());
  const [currentStep, setCurrentStep] = useState(-1);
  const [swing, setSwing] = useState(0);
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

  // Wire step callback
  useEffect(() => {
    playerRef.current.onStep = (step) => setCurrentStep(step);
    return () => { playerRef.current.onStep = null; };
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
      setCurrentStep(-1);
    } else {
      if (!pack) return;
      setAudioLoading(true);
      setMutedVoices(new Set());
      try {
        await player.load(pack);
        await player.loadBeatPattern(beatPattern, pack.state.bpm, pack.state.bars ?? 4, swing);
        player.play();
        setPlaying(true);
      } catch (e) {
        const msg = e instanceof Error && (e.name === 'NotAllowedError' || e.message.includes('suspended'))
          ? 'TAP SCREEN TO UNLOCK AUDIO'
          : 'AUDIO ERROR — TAP TO RETRY';
        showToast(msg, 'error');
        console.error(e);
      }
      setAudioLoading(false);
    }
  }, [playing, pack, beatPattern, swing, showToast]);

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
    setRepairReport([]);
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
            setBeatPattern(packToBeatPattern(regen));
            setPrevPack(newPack); setPack(regen); setGenerating(false); return;
          }
        }
        setSeedInput(newPack.state.seed.toString(16).toUpperCase());
        setPrevPack(pack); setPack(newPack);
        setValidation(validatePocketPack(newPack));
        setBeatPattern(packToBeatPattern(newPack));
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
      const validationBefore = validatePocketPack(pack);
      const repaired = repairWeakLanes(pack);
      const repairedWithMeta: GeneratedPack = { ...repaired, repairWarnings: validationBefore.issues };
      setPrevPack(pack); setPack(repairedWithMeta);
      const result = validatePocketPack(repairedWithMeta);
      setValidation(result);
      setRepairReport(validationBefore.weakLanes.map(l => l.toUpperCase()));
      showToast(result.valid ? `REPAIRED ⟶ ${repaired.fingerprint}` : 'REPAIR PARTIAL — STILL WEAK', result.valid ? 'success' : 'error');
    } catch (e) { showToast('REPAIR FAILED', 'error'); console.error(e); }
    setRepairing(false);
  }, [pack, repairing, showToast]);

  const handleRepairLane = useCallback((lane: 'chords' | 'bass' | 'melody' | 'drums') => {
    if (!pack || repairing) return;
    setRepairing(true);
    try {
      const issuesBefore = validatePocketPack(pack).issues;
      const repaired = repairLane(pack, lane);
      const repairedWithMeta: GeneratedPack = { ...repaired, repairWarnings: issuesBefore };
      setPrevPack(pack); setPack(repairedWithMeta);
      const result = validatePocketPack(repairedWithMeta);
      setValidation(result);
      setRepairReport([lane.toUpperCase()]);
      showToast(`REPAIRED ${lane.toUpperCase()} ⟶ ${repaired.fingerprint}`, 'success');
    } catch (e) { showToast('REPAIR FAILED', 'error'); }
    setRepairing(false);
  }, [pack, repairing, showToast]);

  const handleMutateWithDimension = useCallback((target: MutationTarget, dimension: MutationDimension) => {
    if (!pack) return;
    const mutated = mutateVoiceWithDimension(pack, target, dimension);
    setPrevPack(pack); setPack(mutated);
    setValidation(validatePocketPack(mutated));
    showToast(`${dimension.toUpperCase()} MUTATED ⟶ ${mutated.fingerprint}`);
  }, [pack, showToast]);

  const handleUndo = useCallback(() => {
    if (!prevPack) return;
    setPack(prevPack); setPrevPack(null);
    setValidation(validatePocketPack(prevPack));
    setRepairReport([]);
    showToast('UNDONE');
  }, [prevPack, showToast]);

  const handleExport = useCallback(async () => {
    if (!pack || exporting) return;
    setExporting(true);
    try {
      const [previewWavBuf, melodyStemBuf] = await Promise.all([
        renderToWav(pack, loopMode),
        renderMelodyStem(pack),
      ]);
      const previewWav   = new Uint8Array(previewWavBuf);
      const melodyStemWav = new Uint8Array(melodyStemBuf);
      const blob = await buildZip(pack, loopMode, previewWav, melodyStemWav, pack.repairWarnings ?? []);
      downloadZip(blob, pack.fingerprint, pack.state.bpm, NOTE_NAMES[pack.state.key % 12], pack.state.bars ?? 4);
      showToast(`POCKET PACK READY ⟶ ${pack.fingerprint}`);
    } catch (e) {
      showToast(e instanceof Error && e.message ? `ZIP FAILED: ${e.message.slice(0, 40)}` : 'ZIP EXPORT FAILED', 'error');
      console.error(e);
    }
    setExporting(false);
  }, [pack, exporting, loopMode, showToast]);

  const handleBounce = useCallback(async () => {
    if (!pack || bouncing) return;
    setBouncing(true);
    try {
      await bounceToWav(pack, loopMode);
      showToast(`BOUNCED EngenderEngine_${pack.fingerprint}_${pack.state.bpm}BPM_${loopMode}x.wav`);
    } catch (e) { showToast('WAV BOUNCE FAILED — CHECK AUDIO CONTEXT', 'error'); console.error(e); }
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
    setRepairReport([]);
    setGenre(snap.state.genre); setDna(snap.state.dna); setKey(snap.state.key);
    setScale(snap.state.scale); setBpm(snap.state.bpm); setBars(snap.state.bars ?? 4);
    setSeedInput(snap.state.seed.toString(16).toUpperCase());
    showToast(`RECALLED ${snap.fingerprint}`);
  }, [pack, showToast]);

  const handleDeleteSnapshot = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation(); deleteSnapshot(id); setSnapshots(loadSnapshots());
  }, []);

  const handleDuplicateSnapshot = useCallback((id: string, e: React.MouseEvent) => {
    e.stopPropagation();
    duplicateSnapshot(id);
    setSnapshots(loadSnapshots());
    showToast('SNAPSHOT DUPLICATED');
  }, [showToast]);

  const handleBranchFromSnapshot = useCallback((snap: Snapshot, e: React.MouseEvent) => {
    e.stopPropagation();
    if (!pack) return;
    branchFromSnapshot(snap.id, pack.state, pack.scores, pack.fingerprint);
    setSnapshots(loadSnapshots());
    showToast(`BRANCHED FROM ${snap.fingerprint}`);
  }, [pack, showToast]);

  const handlePadTrigger = useCallback(async (padId: PadId, velocity: number, pitch: number) => {
    if (!playerRef.current.initialized) {
      if (!pack) return;
      await playerRef.current.load(pack);
    }
    playerRef.current.triggerPad(padId, velocity, pitch);
  }, [pack]);

  const handleSwingChange = useCallback(async (v: number) => {
    setSwing(v);
    if (playing && pack) {
      await playerRef.current.loadBeatPattern(beatPattern, pack.state.bpm, pack.state.bars ?? 4, v);
    }
  }, [playing, pack, beatPattern]);

  const scores = pack?.scores;
  const fingerprint = pack?.fingerprint ?? '------';
  const tree = pack?.state.mutationTree ?? [];
  const scaleValidation = pack ? validateScaleNotes(pack.melody, pack.state.key, pack.state.scale) : null;

  return (
    <div className="app">
      {toast && <div className={`toast visible ${toast.type}`}>{toast.msg}</div>}
      <header className="header">
        <div className="header-logo">ENGENDER ENGINE™<span className="header-version"> v{APP_VERSION}</span></div>
        <div className="header-fp"><span>ID</span><span className="fp-badge">{fingerprint}</span></div>
      </header>
      {!pack && (
        <div className="app-tagline">Generate beat DNA. Repair weak lanes. Export MIDI + WAV.</div>
      )}
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
              <option value={8}>8 BARS</option>
              <option value={16}>16 BARS</option>
              <option value={32}>32 BARS</option>
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
            {(['bounce', 'pocket', 'darkness', 'originality', 'tension', 'movement', 'simplicity'] as const).map(k => (
              <div key={k} className="telemetry-card">
                <div className="tel-name">{k.toUpperCase()}</div>
                <div className={`tel-value ${k}`}>{scores[k] ?? 0}</div>
                <div className="tel-bar"><div className={`tel-bar-fill ${k}`} style={{ width: `${scores[k] ?? 0}%` }} /></div>
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
                <div className="repair-btns">
                  <button className="btn-repair" onClick={handleRepair} disabled={repairing}>
                    {repairing ? '⧗ REPAIRING…' : '⟳ REPAIR WEAK LANES'}
                  </button>
                  {validation.weakLanes.map(lane => (
                    <button key={lane} className={`btn-repair-lane ${lane}`} onClick={() => handleRepairLane(lane)} disabled={repairing}>
                      FIX {lane.toUpperCase()}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
          {repairReport.length > 0 && (
            <div className="repair-report">
              ✓ REPAIRED: {repairReport.join(', ')}
            </div>
          )}
        </div>
      )}
      {pack ? (
        <div className="section">
          <div className="section-label">MUTATION ENGINE</div>
          <div className="mutation-btns">
            {(['melody', 'chords', 'bass', 'drums'] as const).map(t => (
              <button key={t} className={`btn-mutate ${t}`} onClick={() => handleMutate(t)}>MUTATE {t.toUpperCase()}</button>
            ))}
          </div>
          <div className="mutation-btns mutation-dim-row">
            <button className="btn-mutate groove" onClick={() => handleMutateWithDimension('drums', 'groove')}>MUTATE GROOVE</button>
            <button className="btn-mutate velocity" onClick={() => handleMutateWithDimension('melody', 'velocity')}>MUTATE VELOCITY</button>
            <button className="btn-mutate rhythm" onClick={() => handleMutateWithDimension('melody', 'rhythm')}>MUTATE RHYTHM</button>
            <button className="btn-mutate density" onClick={() => handleMutateWithDimension('chords', 'density')}>MUTATE DENSITY</button>
            <button className="btn-mutate humanization" onClick={() => handleMutateWithDimension('bass', 'humanization')}>MUTATE HUMAN.</button>
          </div>
          {prevPack && (
            <button className="btn-undo" onClick={handleUndo}>↩ UNDO LAST MUTATION</button>
          )}
          {tree.length > 0 ? (
            <div className="mutation-tree">
              {tree.map(node => (
                <span key={node.id} className={`mutation-node ${node.target}${node.id === pack.state.activeNodeId ? ' active' : ''}`}>{node.id}</span>
              ))}
            </div>
          ) : (
            <div className="empty-state empty-state-sm">NO MUTATIONS YET — HIT MUTATE TO FORK</div>
          )}
        </div>
      ) : (
        <div className="section">
          <div className="section-label">MUTATION ENGINE</div>
          <div className="empty-state">GENERATE A PACK TO UNLOCK MUTATIONS</div>
        </div>
      )}
      <BeatMaker
        pack={pack}
        playing={playing}
        currentStep={currentStep}
        swing={swing}
        onSwingChange={handleSwingChange}
        onPatternChange={setBeatPattern}
        onPadTrigger={handlePadTrigger}
      />
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
              <div className="snap-actions">
                <button className="snap-duplicate" onClick={e => handleDuplicateSnapshot(snap.id, e)} title="Duplicate">⧉</button>
                <button className="snap-branch" onClick={e => handleBranchFromSnapshot(snap, e)} title="Branch from here" disabled={!pack}>⑂</button>
                <button className="snap-delete" onClick={e => handleDeleteSnapshot(snap.id, e)} title="Delete">×</button>
              </div>
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
                <span className="export-sub">10 FILES: 4 MIDI + 5 JSON + WAV</span>
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
