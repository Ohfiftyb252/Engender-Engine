import * as Tone from 'tone';
import type { GeneratedPack, MidiEvent, MutationTarget } from '../types';

function gridToTime(pos: number): string {
  return `${Math.floor(pos / 16)}:${Math.floor((pos % 16) / 4)}:${pos % 4}`;
}

interface PartEvent {
  time: string;
  pitch: number;
  duration: number;
  velocity: number;
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
  // synth voices — typed loosely so we can store any triggerable source
  private chordsSynth: Tone.PolySynth | null = null;
  private melodySynth: Tone.Synth | null = null;
  private bassSynth: Tone.MonoSynth | null = null;
  // all effect/processor nodes — disposed together
  private fx: Array<{ dispose(): void }> = [];
  private mutedVoices = new Set<MutationTarget>();
  private _playing = false;

  get playing(): boolean { return this._playing; }

  async load(pack: GeneratedPack): Promise<void> {
    this.dispose();
    await Tone.start();

    Tone.Transport.bpm.value = pack.state.bpm;
    Tone.Transport.loop = true;
    Tone.Transport.loopStart = 0;
    Tone.Transport.loopEnd = '4m';

    const s16 = 60 / pack.state.bpm / 4; // seconds per 16th-note grid tick

    // ─── 808 BASS ────────────────────────────────────────────────────────────
    // Sine MonoSynth with portamento (pitch slide) → Chebyshev saturation
    // → light overdrive → low-pass → compressor.  Tuned to sit like a trap 808.
    this.bassSynth = new Tone.MonoSynth({
      portamento: 0.07,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 3.2, sustain: 0.0, release: 0.8 },
      volume: 2,
    });
    const bassSat   = new Tone.Chebyshev(3);
    const bassDist  = new Tone.Distortion({ distortion: 0.18, wet: 0.3 });
    const bassLpf   = new Tone.Filter({ frequency: 220, type: 'lowpass', rolloff: -24 });
    const bassComp  = new Tone.Compressor({ threshold: -16, ratio: 10, attack: 0.001, release: 0.08 });
    this.bassSynth.chain(bassSat, bassDist, bassLpf, bassComp, Tone.Destination);
    this.fx.push(bassSat, bassDist, bassLpf, bassComp);

    // ─── DARK CHORD PAD ──────────────────────────────────────────────────────
    // Three detuned fat sawtooth oscillators → low-pass → chorus → long reverb.
    // The spread + chorus width approximates a stacked pad / dark piano hybrid.
    this.chordsSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'fatsawtooth', count: 3, spread: 22 } as // eslint-disable-next-line @typescript-eslint/no-explicit-any
any,
      envelope: { attack: 0.12, decay: 0.5, sustain: 0.55, release: 3.0 },
      volume: -14,
    });
    const chordsLpf    = new Tone.Filter({ frequency: 1600, type: 'lowpass', rolloff: -12 });
    const chordsChorus = new Tone.Chorus(1.4, 3.5, 0.65);
    chordsChorus.start(); // LFO must be started or modulation never runs
    const chordsReverb = new Tone.Reverb({ decay: 5.0, wet: 0.52 });
    await chordsReverb.generate();
    this.chordsSynth.chain(chordsLpf, chordsChorus, chordsReverb, Tone.Destination);
    this.fx.push(chordsLpf, chordsChorus, chordsReverb);

    // ─── DARK MELODY LEAD ────────────────────────────────────────────────────
    // Two slightly detuned fat triangles → ping-pong delay → reverb.
    // Sits between a flute, a dark lead, and a ghostly pad.
    this.melodySynth = new Tone.Synth({
      oscillator: { type: 'fattriangle', count: 2, spread: 12 } as // eslint-disable-next-line @typescript-eslint/no-explicit-any
any,
      envelope: { attack: 0.04, decay: 0.18, sustain: 0.52, release: 0.55 },
      volume: -9,
    });
    const melodyDelay  = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.22, wet: 0.18 });
    const melodyReverb = new Tone.Reverb({ decay: 2.8, wet: 0.32 });
    await melodyReverb.generate();
    this.melodySynth.chain(melodyDelay, melodyReverb, Tone.Destination);
    this.fx.push(melodyDelay, melodyReverb);

    // ─── SCHEDULE PARTS ──────────────────────────────────────────────────────
    const makePart = (
      events: MidiEvent[],
      trigger: (time: number, e: PartEvent) => void
    ): Tone.Part<PartEvent> => {
      const part = new Tone.Part<PartEvent>(trigger, mapEvents(events));
      part.loop = true;
      part.loopEnd = '4m';
      part.start(0);
      return part;
    };

    this.parts = [
      makePart(pack.chords, (time, e) => {
        if (!this.mutedVoices.has('chords'))
          this.chordsSynth!.triggerAttackRelease(
            Tone.Frequency(e.pitch, 'midi').toNote(),
            Math.max(1, e.duration) * s16,
            time,
            (e.velocity / 127) * 0.82
          );
      }),
      makePart(pack.melody, (time, e) => {
        if (!this.mutedVoices.has('melody'))
          this.melodySynth!.triggerAttackRelease(
            Tone.Frequency(e.pitch, 'midi').toNote(),
            Math.max(1, e.duration) * s16,
            time,
            (e.velocity / 127) * 0.88
          );
      }),
      makePart(pack.bass, (time, e) => {
        if (!this.mutedVoices.has('bass'))
          this.bassSynth!.triggerAttackRelease(
            Tone.Frequency(e.pitch, 'midi').toNote(),
            Math.max(1, e.duration) * s16,
            time,
            (e.velocity / 127) * 0.95
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
    this.parts.forEach(p => { try { p.dispose(); } catch { /* already disposed */ } });
    this.parts = [];
    try { this.chordsSynth?.dispose(); } catch { /* already disposed */ }
    try { this.melodySynth?.dispose(); } catch { /* already disposed */ }
    try { this.bassSynth?.dispose(); } catch { /* already disposed */ }
    this.fx.forEach(n => { try { n.dispose(); } catch { /* already disposed */ } });
    this.fx = [];
    this.chordsSynth = null;
    this.melodySynth = null;
    this.bassSynth = null;
    this.mutedVoices.clear();
  }
}

// ─── OFFLINE BOUNCE TO WAV ─────────────────────────────────────────────────
// Renders 4 bars of the pack to a stereo WAV using Tone.js offline context.

export async function bounceToWav(pack: GeneratedPack): Promise<void> {
  const bpm = pack.state.bpm;
  const s16 = 60 / bpm / 4;
  const durationBars = 4;
  const durationSecs = durationBars * 4 * (60 / bpm) + 1; // +1s tail for reverb decay

  const buffer = await Tone.Offline(async ({ transport }) => {
    transport.bpm.value = bpm;

    // Bass
    const bass = new Tone.MonoSynth({
      portamento: 0.07,
      oscillator: { type: 'sine' },
      envelope: { attack: 0.001, decay: 3.2, sustain: 0.0, release: 0.8 },
      volume: 2,
    });
    const bassSat  = new Tone.Chebyshev(3);
    const bassDist = new Tone.Distortion({ distortion: 0.18, wet: 0.3 });
    const bassLpf  = new Tone.Filter({ frequency: 220, type: 'lowpass', rolloff: -24 });
    const bassComp = new Tone.Compressor({ threshold: -16, ratio: 10, attack: 0.001, release: 0.08 });
    bass.chain(bassSat, bassDist, bassLpf, bassComp, Tone.getDestination());

    // Chords
    const chords = new Tone.PolySynth(Tone.Synth, {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      oscillator: { type: 'fatsawtooth', count: 3, spread: 22 } as any,
      envelope: { attack: 0.12, decay: 0.5, sustain: 0.55, release: 3.0 },
      volume: -14,
    });
    const chordsLpf    = new Tone.Filter({ frequency: 1600, type: 'lowpass', rolloff: -12 });
    const chordsChorus = new Tone.Chorus(1.4, 3.5, 0.65);
    chordsChorus.start(0);
    const chordsReverb = new Tone.Reverb({ decay: 5.0, wet: 0.52 });
    await chordsReverb.generate();
    chords.chain(chordsLpf, chordsChorus, chordsReverb, Tone.getDestination());

    // Melody
    const melody = new Tone.Synth({
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      oscillator: { type: 'fattriangle', count: 2, spread: 12 } as any,
      envelope: { attack: 0.04, decay: 0.18, sustain: 0.52, release: 0.55 },
      volume: -9,
    });
    const melodyDelay  = new Tone.FeedbackDelay({ delayTime: '8n', feedback: 0.22, wet: 0.18 });
    const melodyReverb = new Tone.Reverb({ decay: 2.8, wet: 0.32 });
    await melodyReverb.generate();
    melody.chain(melodyDelay, melodyReverb, Tone.getDestination());

    // Schedule all events
    pack.chords.forEach(e => {
      transport.schedule(t => {
        chords.triggerAttackRelease(
          Tone.Frequency(e.pitch, 'midi').toNote(),
          Math.max(1, e.duration) * s16, t, (e.velocity / 127) * 0.82
        );
      }, gridToTime(e.position));
    });
    pack.melody.forEach(e => {
      transport.schedule(t => {
        melody.triggerAttackRelease(
          Tone.Frequency(e.pitch, 'midi').toNote(),
          Math.max(1, e.duration) * s16, t, (e.velocity / 127) * 0.88
        );
      }, gridToTime(e.position));
    });
    pack.bass.forEach(e => {
      transport.schedule(t => {
        bass.triggerAttackRelease(
          Tone.Frequency(e.pitch, 'midi').toNote(),
          Math.max(1, e.duration) * s16, t, (e.velocity / 127) * 0.95
        );
      }, gridToTime(e.position));
    });

    transport.start(0);
  }, durationSecs);

  // Convert AudioBuffer → WAV Blob → download
  const wav = audioBufferToWav(buffer.get()!);
  const blob = new Blob([wav], { type: 'audio/wav' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `EngenderEngine_${pack.fingerprint}_${pack.state.bpm}BPM.wav`;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => { document.body.removeChild(a); URL.revokeObjectURL(url); }, 1000);
}

function audioBufferToWav(buffer: AudioBuffer): ArrayBuffer {
  const numCh  = buffer.numberOfChannels;
  const rate   = buffer.sampleRate;
  const length = buffer.length;
  const bitsPerSample = 16;
  const blockAlign = numCh * (bitsPerSample / 8);
  const byteRate   = rate * blockAlign;
  const dataSize   = length * blockAlign;
  const ab  = new ArrayBuffer(44 + dataSize);
  const view = new DataView(ab);

  const str = (off: number, s: string) => { for (let i = 0; i < s.length; i++) view.setUint8(off + i, s.charCodeAt(i)); };
  str(0, 'RIFF'); view.setUint32(4, 36 + dataSize, true);
  str(8, 'WAVE'); str(12, 'fmt ');
  view.setUint32(16, 16, true);    // fmt chunk size
  view.setUint16(20, 1, true);     // PCM
  view.setUint16(22, numCh, true);
  view.setUint32(24, rate, true);
  view.setUint32(28, byteRate, true);
  view.setUint16(32, blockAlign, true);
  view.setUint16(34, bitsPerSample, true);
  str(36, 'data'); view.setUint32(40, dataSize, true);

  let offset = 44;
  for (let i = 0; i < length; i++) {
    for (let ch = 0; ch < numCh; ch++) {
      const sample = Math.max(-1, Math.min(1, buffer.getChannelData(ch)[i]));
      view.setInt16(offset, sample < 0 ? sample * 0x8000 : sample * 0x7FFF, true);
      offset += 2;
    }
  }
  return ab;
}
