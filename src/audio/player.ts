import * as Tone from 'tone';
import type { GeneratedPack, MidiEvent, MutationTarget } from '../types';

interface PartEvent {
  time: string;
  pitch: number;
  duration: number;
  velocity: number;
}

// 16th-note grid position → Tone.js Bars:Beats:Sixteenths
function gridToTime(pos: number): string {
  return `${Math.floor(pos / 16)}:${Math.floor((pos % 16) / 4)}:${pos % 4}`;
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
  private parts: Tone.Part<PartEvent>[] = [];
  private chordsSynth: Tone.PolySynth | null = null;
  private melodySynth: Tone.Synth | null = null;
  private bassSynth: Tone.MonoSynth | null = null;
  private fx: Array<{ dispose(): void }> = [];
  private mutedVoices = new Set<MutationTarget>();
  private _playing = false;

  get playing(): boolean { return this._playing; }

  async load(pack: GeneratedPack): Promise<void> {
    this.dispose();
    await Tone.start();

    const bars = pack.state.bars ?? 4;
    const loopEnd = `${bars}m`;

    Tone.Transport.bpm.value = pack.state.bpm;
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = loopEnd;

    const s16 = 60 / pack.state.bpm / 4;

    // ─── 808 BASS ───────────────────────────────────────────────────────────
    this.bassSynth = new Tone.MonoSynth({
      portamento: 0.08,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 3.0, sustain: 0.0, release: 0.8 },
      volume: 2,
    });
    const bassDist = new Tone.Distortion({ distortion: 0.25, wet: 0.35 });
    const bassLpf  = new Tone.Filter({ frequency: 240, type: 'lowpass', rolloff: -24 });
    this.bassSynth.chain(bassDist, bassLpf, Tone.Destination);
    this.fx.push(bassDist, bassLpf);

    // ─── DARK CHORD PAD ─────────────────────────────────────────────────────
    this.chordsSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.15, decay: 0.4, sustain: 0.6, release: 3.5 },
      volume: -12,
    });
    const chordsLpf   = new Tone.Filter({ frequency: 1800, type: 'lowpass', rolloff: -12 });
    const chordsVerb  = new Tone.Reverb({ decay: 5.0, wet: 0.55 });
    await chordsVerb.generate();
    this.chordsSynth.chain(chordsLpf, chordsVerb, Tone.Destination);
    this.fx.push(chordsLpf, chordsVerb);

    // ─── DARK MELODY LEAD ───────────────────────────────────────────────────
    this.melodySynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.04, decay: 0.15, sustain: 0.5, release: 0.6 },
      volume: -8,
    });
    const melodyDelay = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.2, wet: 0.2 });
    const melodyVerb  = new Tone.Reverb({ decay: 2.5, wet: 0.35 });
    await melodyVerb.generate();
    this.melodySynth.chain(melodyDelay, melodyVerb, Tone.Destination);
    this.fx.push(melodyDelay, melodyVerb);

    // ─── SCHEDULE LOOPING PARTS ─────────────────────────────────────────────
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

    this.parts = [
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
    ];
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
    this.parts.forEach(p => { try { p.dispose(); } catch { /* ok */ } });
    this.parts = [];
    try { this.chordsSynth?.dispose(); } catch { /* ok */ }
    try { this.melodySynth?.dispose(); } catch { /* ok */ }
    try { this.bassSynth?.dispose(); } catch { /* ok */ }
    this.fx.forEach(n => { try { n.dispose(); } catch { /* ok */ } });
    this.fx = [];
    this.chordsSynth = null;
    this.melodySynth = null;
    this.bassSynth = null;
    this.mutedVoices.clear();
  }
}

// ─── BOUNCE TO WAV ──────────────────────────────────────────────────────────
// Uses Tone.Offline to render bars×loopMode bars to a 16-bit stereo WAV.
// Scheduling uses raw seconds (not BBT strings) so offline transport fires correctly.

export async function bounceToWav(pack: GeneratedPack, loopMode: 1 | 2 | 4 = 1): Promise<void> {
  const bpm = pack.state.bpm;
  const bars = pack.state.bars ?? 4;
  const s16 = 60 / bpm / 4;
  const barLen = 4 * (60 / bpm);
  const patternSecs = bars * barLen;
  const durationSecs = loopMode * patternSecs + 1.5;  // + reverb tail

  const toneBuffer = await Tone.Offline(async (ctx) => {
    ctx.transport.bpm.value = bpm;
    ctx.transport.start(0);

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

    for (let loopIdx = 0; loopIdx < loopMode; loopIdx++) {
      const offset = loopIdx * bars * 16 * s16;

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
    }
  }, durationSecs);

  const raw = toneBuffer.get();
  if (!raw) throw new Error('Offline render returned empty buffer');

  const wav  = audioBufferToWav(raw);
  const blob = new Blob([wav], { type: 'audio/wav' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `EngenderEngine_${pack.fingerprint}_${pack.state.bpm}BPM_${loopMode}x.wav`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
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

  const w  = (off: number, s: string) => { for (let i = 0; i < s.length; i++) v.setUint8(off + i, s.charCodeAt(i)); };
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
