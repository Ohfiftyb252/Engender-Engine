import * as Tone from 'tone';
import type { DrumLane, GeneratedPack, MidiEvent, MutationTarget, Step, BeatPattern, PadId } from '../types';
import { mulberry32 } from '../engine/prng';

interface PartEvent {
  time: string;
  pitch: number;
  duration: number;
  velocity: number;
}

interface DrumPartEvent {
  time: string;
  lane: DrumLane;
  velocity: number;
}

// 16th-note grid position → Tone.js Bars:Beats:Sixteenths
function gridToTime(pos: number): string {
  const p = Math.round(pos); // round for BBT string compat
  return `${Math.floor(p / 16)}:${Math.floor((p % 16) / 4)}:${p % 4}`;
}

function mapEvents(events: MidiEvent[]): PartEvent[] {
  return events.map(e => ({
    time: gridToTime(e.position),
    pitch: e.pitch,
    duration: e.duration,
    velocity: e.velocity,
  }));
}

export class EnginePlayer {
  private parts: Array<{ dispose(): void }> = [];
  private chordsSynth: Tone.PolySynth | null = null;
  private melodySynth: Tone.Synth | null = null;
  private bassSynth: Tone.MonoSynth | null = null;
  private kickSynth: Tone.MembraneSynth | null = null;
  private snareSynth: Tone.NoiseSynth | null = null;
  private hatSynth: Tone.NoiseSynth | null = null;
  private fx: Array<{ dispose(): void }> = [];
  private mutedVoices = new Set<MutationTarget>();
  private _playing = false;
  private stepSeq: { dispose(): void } | null = null;

  public onStep: ((step: number) => void) | null = null;

  get playing(): boolean { return this._playing; }

  get initialized(): boolean { return this.kickSynth !== null; }

  async load(pack: GeneratedPack): Promise<void> {
    this.dispose();
    await Tone.start();
    // Explicit resume for iOS Safari / Chrome Android — AudioContext may stay
    // suspended even after Tone.start() until the raw context is resumed.
    const rawCtx = Tone.getContext().rawContext as AudioContext;
    if (rawCtx.state !== 'running') {
      await rawCtx.resume().catch(() => {});
    }

    const bars = pack.state.bars ?? 4;
    const loopEnd = `${bars}m`;

    Tone.Transport.bpm.value = pack.state.bpm;
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = loopEnd;

    const s16 = 60 / pack.state.bpm / 4;

    // ─── MASTER CHAIN: knock clipper → true-peak limiter ─────────────────────
    // tanh(x * 1.8) saturates peaks into a warm knock; limiter catches the rest
    const knockClipper = new Tone.WaveShaper((x: number) => Math.tanh(x * 1.8), 4096);
    const masterLimiter = new Tone.Limiter(-0.5);
    knockClipper.chain(masterLimiter);
    masterLimiter.toDestination();
    this.fx.push(knockClipper, masterLimiter);

    // ─── 808 BASS ────────────────────────────────────────────────────────────
    // Sine + subtle dist = real 808 sub energy; portamento for smooth slides
    this.bassSynth = new Tone.MonoSynth({
      portamento: 0.06,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 0.9, sustain: 0.65, release: 0.4 },
      filter: { type: 'lowpass', frequency: 2400, rolloff: -12 },
      filterEnvelope: { attack: 0.001, decay: 0.3, sustain: 0.5, release: 0.3, baseFrequency: 120, octaves: 3 },
      volume: 5,
    });
    const bassDist = new Tone.Distortion({ distortion: 0.08, wet: 0.18 });
    const bassComp = new Tone.Compressor({ threshold: -18, ratio: 4, attack: 0.005, release: 0.2 });
    this.bassSynth.chain(bassDist, bassComp, knockClipper);
    this.fx.push(bassDist, bassComp);

    // ─── CHORD PAD ───────────────────────────────────────────────────────────
    // Saw through filter + moderate verb = present, musical, not washed out
    this.chordsSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.025, decay: 0.4, sustain: 0.55, release: 2.0 },
      volume: -14,
    });
    const chordsFilter = new Tone.Filter({ frequency: 1800, type: 'lowpass', rolloff: -24 });
    const chordsVerb   = new Tone.Reverb({ decay: 2.5, wet: 0.35 });
    await chordsVerb.generate();
    const chordsComp   = new Tone.Compressor(-12, 3);
    this.chordsSynth.chain(chordsFilter, chordsVerb, chordsComp, knockClipper);
    this.fx.push(chordsFilter, chordsVerb, chordsComp);

    // ─── MELODY ──────────────────────────────────────────────────────────────
    // Triangle + tight delay + short verb = cuts through without muddying
    this.melodySynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.015, decay: 0.25, sustain: 0.5, release: 0.9 },
      volume: -8,
    });
    const melodyDelay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.22, wet: 0.18 });
    const melodyVerb  = new Tone.Reverb({ decay: 1.8, wet: 0.22 });
    await melodyVerb.generate();
    this.melodySynth.chain(melodyDelay, melodyVerb, knockClipper);
    this.fx.push(melodyDelay, melodyVerb);

    // ─── KICK ────────────────────────────────────────────────────────────────
    // Short pitch drop = maximum punch; compressor glues it
    this.kickSynth = new Tone.MembraneSynth({
      pitchDecay: 0.055,
      octaves: 5,
      envelope: { attack: 0.001, decay: 0.42, sustain: 0, release: 0.1 },
      volume: 4,
    });
    const kickComp = new Tone.Compressor({ threshold: -6, ratio: 6, attack: 0.001, release: 0.08 });
    this.kickSynth.chain(kickComp, knockClipper);
    this.fx.push(kickComp);

    // ─── SNARE / CLAP ────────────────────────────────────────────────────────
    // White noise HPF at 400Hz = crack AND body; tiny room adds size
    this.snareSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.18, sustain: 0, release: 0.06 },
      volume: -3,
    });
    const snareHpf  = new Tone.Filter({ frequency: 400, type: 'highpass' });
    const snareLpf  = new Tone.Filter({ frequency: 10000, type: 'lowpass' });
    const snareVerb = new Tone.Reverb({ decay: 0.6, wet: 0.12 });
    await snareVerb.generate();
    this.snareSynth.chain(snareHpf, snareLpf, snareVerb, knockClipper);
    this.fx.push(snareHpf, snareLpf, snareVerb);

    // ─── HATS ────────────────────────────────────────────────────────────────
    // White noise HPF = crisp and tight, never harsh
    this.hatSynth = new Tone.NoiseSynth({
      noise: { type: 'white' },
      envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.008 },
      volume: -14,
    });
    const hatHpf = new Tone.Filter({ frequency: 6000, type: 'highpass' });
    this.hatSynth.chain(hatHpf, knockClipper);
    this.fx.push(hatHpf);

    // ─── SCHEDULE PARTS ──────────────────────────────────────────────────────
    const makePart = (
      events: MidiEvent[],
      trigger: (time: number, e: PartEvent) => void
    ): Tone.Part<PartEvent> => {
      const part = new Tone.Part<PartEvent>(trigger, mapEvents(events));
      part.loop = true;
      part.loopEnd = loopEnd;
      part.start(0);
      return part;
    };

    this.parts.push(
      makePart(pack.chords, (time, e) => {
        if (!this.mutedVoices.has('chords'))
          this.chordsSynth!.triggerAttackRelease(
            Tone.Frequency(e.pitch, 'midi').toNote(),
            Math.max(1, e.duration) * s16, time, (e.velocity / 127) * 0.82
          );
      }),
      makePart(pack.melody, (time, e) => {
        if (!this.mutedVoices.has('melody'))
          this.melodySynth!.triggerAttackRelease(
            Tone.Frequency(e.pitch, 'midi').toNote(),
            Math.max(1, e.duration) * s16, time, (e.velocity / 127) * 0.88
          );
      }),
      makePart(pack.bass, (time, e) => {
        if (!this.mutedVoices.has('bass'))
          this.bassSynth!.triggerAttackRelease(
            Tone.Frequency(e.pitch, 'midi').toNote(),
            Math.max(1, e.duration) * s16, time, (e.velocity / 127) * 0.95
          );
      }),
    );

    // Drum part — positions rounded to 16th grid for BBT compat
    const drumItems: DrumPartEvent[] = pack.drums.events.map(e => ({
      time: gridToTime(e.position),
      lane: e.lane,
      velocity: e.velocity,
    }));
    const drumPart = new Tone.Part<DrumPartEvent>((time, e) => {
      if (this.mutedVoices.has('drums')) return;
      const vel = e.velocity / 127;
      switch (e.lane) {
        case 'kick':
          this.kickSynth!.triggerAttackRelease('C1', '8n', time, vel);
          break;
        case 'snare':
        case 'clap':
          this.snareSynth!.triggerAttackRelease('16n', time, vel);
          break;
        case 'hat':
          this.hatSynth!.triggerAttackRelease('32n', time, vel);
          break;
        case 'openHat':
          this.hatSynth!.triggerAttackRelease('16n', time, vel * 0.85);
          break;
      }
    }, drumItems);
    drumPart.loop = true;
    drumPart.loopEnd = loopEnd;
    drumPart.start(0);
    this.parts.push(drumPart);
  }

  play(): void {
    Tone.Transport.start();
    this._playing = true;
  }

  stop(): void {
    Tone.Transport.stop();
    this._playing = false;
  }

  toggleMute(voice: MutationTarget): void {
    if (this.mutedVoices.has(voice)) this.mutedVoices.delete(voice);
    else this.mutedVoices.add(voice);
  }

  isMuted(voice: MutationTarget): boolean {
    return this.mutedVoices.has(voice);
  }

  dispose(): void {
    this.stop();
    if (this.stepSeq) { try { this.stepSeq.dispose(); } catch { /* ok */ } this.stepSeq = null; }
    this.parts.forEach(p => { try { p.dispose(); } catch { /* ok */ } });
    this.parts = [];
    [this.chordsSynth, this.melodySynth, this.bassSynth,
     this.kickSynth, this.snareSynth, this.hatSynth].forEach(s => {
      try { s?.dispose(); } catch { /* ok */ }
    });
    this.fx.forEach(n => { try { n.dispose(); } catch { /* ok */ } });
    this.fx = [];
    this.chordsSynth = null; this.melodySynth = null; this.bassSynth = null;
    this.kickSynth = null; this.snareSynth = null; this.hatSynth = null;
    this.mutedVoices.clear();
  }

  public triggerPad(padId: PadId, velocity: number, pitch: number, time?: number): void {
    const vel = Math.max(0.01, Math.min(1, velocity / 127));
    const t = time ?? Tone.now();
    switch (padId) {
      case 'kick':
        this.kickSynth?.triggerAttackRelease('C1', '8n', t, vel);
        break;
      case 'snare':
      case 'clap':
        this.snareSynth?.triggerAttackRelease('16n', t, vel);
        break;
      case 'hat':
        this.hatSynth?.triggerAttackRelease('32n', t, vel);
        break;
      case 'openHat':
        this.hatSynth?.triggerAttackRelease('16n', t, vel * 0.85);
        break;
      case 'bass':
        this.bassSynth?.triggerAttackRelease(Tone.Frequency(pitch, 'midi').toNote(), '8n', t, vel);
        break;
      case 'melody':
        this.melodySynth?.triggerAttackRelease(Tone.Frequency(pitch, 'midi').toNote(), '16n', t, vel);
        break;
      case 'chords':
        this.chordsSynth?.triggerAttackRelease(Tone.Frequency(pitch, 'midi').toNote(), '4n', t, vel);
        break;
    }
  }

  public async loadBeatPattern(pattern: BeatPattern, bpm: number, bars: number, swing: number): Promise<void> {
    // Dispose old step seq
    if (this.stepSeq) { try { this.stepSeq.dispose(); } catch { /* ok */ } this.stepSeq = null; }
    // Clear Tone.Part-based parts
    this.parts.forEach(p => { try { p.dispose(); } catch { /* ok */ } });
    this.parts = [];

    await Tone.start();

    Tone.Transport.bpm.value = bpm;
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = `${bars}m`;
    Tone.Transport.swing = swing;
    (Tone.Transport as unknown as Record<string, unknown>).swingSubdivision = '16n';

    const steps = [...Array(16).keys()];
    const seq = new Tone.Sequence((time: number, step: unknown) => {
      const s = step as number;
      this.onStep?.(s);
      const entries = Object.entries(pattern) as [string, Step[]][];
      for (const [padId, padSteps] of entries) {
        const st = padSteps[s];
        if (!st?.active) continue;
        if (this.mutedVoices.has(padId as MutationTarget)) continue;
        this.triggerPad(padId as PadId, st.velocity, st.pitch, time);
      }
    }, steps, '16n');
    seq.loop = true;
    seq.start(0);
    this.stepSeq = seq;
  }
}

// ─── DETERMINISTIC NOISE BUFFER ─────────────────────────────────────────────
// Used in the WAV offline render so drum sounds are reproducible given the same seed.

function makeNoiseBuffer(rawCtx: OfflineAudioContext, seed: number, numSamples: number): AudioBuffer {
  const buf = rawCtx.createBuffer(1, numSamples, rawCtx.sampleRate);
  const data = buf.getChannelData(0);
  const rng = mulberry32(seed >>> 0);
  for (let i = 0; i < numSamples; i++) data[i] = (rng() - 0.5) * 2;
  return buf;
}

function scheduleKick(rawCtx: OfflineAudioContext, t: number, gain: number): void {
  const osc = rawCtx.createOscillator();
  osc.type = 'sine';
  osc.frequency.setValueAtTime(80, t);
  osc.frequency.exponentialRampToValueAtTime(25, t + 0.1);
  const g = rawCtx.createGain();
  g.gain.setValueAtTime(gain * 0.9, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.45);
  osc.connect(g); g.connect(rawCtx.destination);
  osc.start(t); osc.stop(t + 0.46);
}

function scheduleSnare(rawCtx: OfflineAudioContext, noiseBuf: AudioBuffer, t: number, gain: number): void {
  const src = rawCtx.createBufferSource();
  src.buffer = noiseBuf;
  const hpf = rawCtx.createBiquadFilter();
  hpf.type = 'highpass'; hpf.frequency.value = 2200;
  const g = rawCtx.createGain();
  g.gain.setValueAtTime(gain * 0.75, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + 0.15);
  src.connect(hpf); hpf.connect(g); g.connect(rawCtx.destination);
  src.start(t); src.stop(t + 0.16);
}

function scheduleHat(rawCtx: OfflineAudioContext, noiseBuf: AudioBuffer, t: number, gain: number, open: boolean): void {
  const src = rawCtx.createBufferSource();
  src.buffer = noiseBuf;
  const hpf = rawCtx.createBiquadFilter();
  hpf.type = 'highpass'; hpf.frequency.value = 8000;
  const decay = open ? 0.18 : 0.055;
  const g = rawCtx.createGain();
  g.gain.setValueAtTime(gain * 0.38, t);
  g.gain.exponentialRampToValueAtTime(0.001, t + decay);
  src.connect(hpf); hpf.connect(g); g.connect(rawCtx.destination);
  src.start(t); src.stop(t + decay + 0.001);
}

// ─── RENDER TO WAV (deterministic) ──────────────────────────────────────────
// Same seed + same settings → identical WAV output.
// Drum sounds use raw AudioContext with seeded noise buffers (no Web Audio noise generator).
// Melodic voices use deterministic oscillators.

export async function renderToWav(pack: GeneratedPack, loopMode: 1 | 2 | 4 = 1): Promise<ArrayBuffer> {
  const bpm = pack.state.bpm;
  const bars = pack.state.bars ?? 4;
  const s16 = 60 / bpm / 4;
  const barLen = 4 * (60 / bpm);
  const patternSecs = bars * barLen;
  const durationSecs = loopMode * patternSecs + 1.5; // + reverb tail

  const toneBuffer = await Tone.Offline(async (ctx) => {
    ctx.transport.bpm.value = bpm;
    ctx.transport.start(0);

    // Access underlying OfflineAudioContext for deterministic drum synthesis
    const rawCtx = (ctx as unknown as { rawContext: OfflineAudioContext }).rawContext;

    // Pre-generate seeded noise buffers (deterministic per seed)
    const snareNoise = makeNoiseBuffer(rawCtx, (pack.state.seed ^ 0x53414445) >>> 0, Math.ceil(rawCtx.sampleRate * 0.2));
    const hatNoise   = makeNoiseBuffer(rawCtx, (pack.state.seed ^ 0x48415400) >>> 0, Math.ceil(rawCtx.sampleRate * 0.25));

    // ── Melodic synths ──
    const bassS = new Tone.MonoSynth({
      portamento: 0.08,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 3.0, sustain: 0.0, release: 0.8 },
      volume: 2,
    }).toDestination();

    const chordsS = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.15, decay: 0.4, sustain: 0.6, release: 3.5 },
      volume: -12,
    }).toDestination();

    const melodyS = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.04, decay: 0.15, sustain: 0.5, release: 0.6 },
      volume: -8,
    }).toDestination();

    for (let loop = 0; loop < loopMode; loop++) {
      const offset = loop * bars * 16 * s16;

      pack.bass.forEach(e => {
        ctx.transport.scheduleOnce(t => {
          bassS.triggerAttackRelease(
            Tone.Frequency(e.pitch, 'midi').toNote(),
            Math.max(1, e.duration) * s16, t, (e.velocity / 127) * 0.95
          );
        }, e.position * s16 + offset);
      });

      pack.chords.forEach(e => {
        ctx.transport.scheduleOnce(t => {
          chordsS.triggerAttackRelease(
            Tone.Frequency(e.pitch, 'midi').toNote(),
            Math.max(1, e.duration) * s16, t, (e.velocity / 127) * 0.82
          );
        }, e.position * s16 + offset);
      });

      pack.melody.forEach(e => {
        ctx.transport.scheduleOnce(t => {
          melodyS.triggerAttackRelease(
            Tone.Frequency(e.pitch, 'midi').toNote(),
            Math.max(1, e.duration) * s16, t, (e.velocity / 127) * 0.88
          );
        }, e.position * s16 + offset);
      });

      // ── Drums (raw AudioContext — deterministic) ──
      pack.drums.events.forEach(e => {
        const eventTime = e.position * s16 + offset;
        const vel = e.velocity / 127;
        ctx.transport.scheduleOnce(t => {
          switch (e.lane) {
            case 'kick':
              scheduleKick(rawCtx, t, vel);
              break;
            case 'snare':
            case 'clap':
              scheduleSnare(rawCtx, snareNoise, t, vel);
              break;
            case 'hat':
              scheduleHat(rawCtx, hatNoise, t, vel, false);
              break;
            case 'openHat':
              scheduleHat(rawCtx, hatNoise, t, vel, true);
              break;
          }
        }, eventTime);
      });
    }
  }, durationSecs);

  const raw = toneBuffer.get();
  if (!raw) throw new Error('Offline render returned empty buffer');
  return audioBufferToWav(raw);
}

// ─── MELODY DARK-SAW STEM RENDER ────────────────────────────────────────────
// Renders only the melody voice through a detuned dual-sawtooth + LPF patch
// using a raw OfflineAudioContext — no Tone.js dependency.

export async function renderMelodyStem(pack: GeneratedPack): Promise<ArrayBuffer> {
  const bpm = pack.state.bpm;
  const bars = pack.state.bars ?? 4;
  const s16 = 60 / bpm / 4;
  const durationSecs = bars * 4 * (60 / bpm) + 2.5; // + release tail

  const SR = 44100;
  const offCtx = new OfflineAudioContext(2, Math.ceil(SR * durationSecs), SR);

  const master = offCtx.createGain();
  master.gain.value = 0.70;
  master.connect(offCtx.destination);

  for (const e of pack.melody) {
    const freq = 440 * Math.pow(2, (e.pitch - 69) / 12);
    const t0   = e.position * s16;
    const dur  = Math.max(1, e.duration) * s16;
    const amp  = (e.velocity / 127) * 0.38;

    const osc1   = offCtx.createOscillator();
    const osc2   = offCtx.createOscillator();
    const filter = offCtx.createBiquadFilter();
    const env    = offCtx.createGain();

    osc1.type = 'sawtooth';
    osc2.type = 'sawtooth';
    osc1.frequency.setValueAtTime(freq, t0);
    osc2.frequency.setValueAtTime(freq * 1.005, t0); // ~5 cents detune

    filter.type = 'lowpass';
    filter.frequency.setValueAtTime(1800, t0);
    filter.Q.setValueAtTime(3.5, t0);

    const releaseAt = Math.max(t0 + 0.03, t0 + dur - 0.01);
    env.gain.setValueAtTime(0.0001, t0);
    env.gain.exponentialRampToValueAtTime(amp, t0 + 0.02);
    env.gain.setValueAtTime(amp, releaseAt);
    env.gain.exponentialRampToValueAtTime(0.0001, releaseAt + 0.4);

    osc1.connect(filter);
    osc2.connect(filter);
    filter.connect(env);
    env.connect(master);

    osc1.start(t0); osc2.start(t0);
    osc1.stop(releaseAt + 0.45); osc2.stop(releaseAt + 0.45);
  }

  const rendered = await offCtx.startRendering();
  return audioBufferToWav(rendered);
}

export async function bounceToWav(pack: GeneratedPack, loopMode: 1 | 2 | 4 = 1): Promise<void> {
  const wav  = await renderToWav(pack, loopMode);
  const blob = new Blob([wav], { type: 'audio/wav' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = wavFilename(pack, loopMode);
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

export function wavFilename(pack: GeneratedPack, loopMode: 1 | 2 | 4): string {
  return `EngenderEngine_${pack.fingerprint}_${pack.state.bpm}BPM_${loopMode}x.wav`;
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numCh = buffer.numberOfChannels;
  const rate  = buffer.sampleRate;
  const len   = buffer.length;
  const bps   = 16;
  const block = numCh * (bps / 8);
  const data  = len * block;
  const ab    = new ArrayBuffer(44 + data);
  const v     = new DataView(ab);

  const w = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
  w(0, 'RIFF'); v.setUint32(4, 36 + data, true);
  w(8, 'WAVE'); w(12, 'fmt ');
  v.setUint32(16, 16, true); v.setUint16(20, 1, true);
  v.setUint16(22, numCh, true); v.setUint32(24, rate, true);
  v.setUint32(28, rate * block, true); v.setUint16(32, block, true);
  v.setUint16(34, bps, true);
  w(36, 'data'); v.setUint32(40, data, true);

  let off = 44;
  for (let i = 0; i < len; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const s = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      v.setInt16(off, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
      off += 2;
    }
  }
  return ab;
}
