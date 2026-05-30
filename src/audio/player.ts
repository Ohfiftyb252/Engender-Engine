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
  private chordsSynth: Tone.PolySynth | null = null;
  private melodySynth: Tone.Synth | null = null;
  private bassSynth: Tone.MonoSynth | null = null;
  private reverb: Tone.Reverb | null = null;
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

    // seconds per 16th-note grid tick — used for note durations
    const s16 = 60 / pack.state.bpm / 4;

    // Chords: dark sawtooth pad through plate reverb
    this.reverb = new Tone.Reverb({ decay: 2.5, wet: 0.28 });
    await this.reverb.generate();
    this.chordsSynth = new Tone.PolySynth(Tone.Synth, {
      oscillator: { type: 'sawtooth' },
      envelope: { attack: 0.1, decay: 0.25, sustain: 0.65, release: 2.0 },
      volume: -10,
    });
    this.chordsSynth.connect(this.reverb);
    this.reverb.toDestination();

    // Melody: triangle wave ghostly stab
    this.melodySynth = new Tone.Synth({
      oscillator: { type: 'triangle' },
      envelope: { attack: 0.015, decay: 0.08, sustain: 0.5, release: 0.35 },
      volume: -7,
    }).toDestination();

    // Bass: 808-style sine with punchy amp envelope
    this.bassSynth = new Tone.MonoSynth({
      oscillator: { type: 'sine' },
      envelope: { attack: 0.005, decay: 1.0, sustain: 0.0, release: 0.6 },
      filterEnvelope: {
        attack: 0.005,
        decay: 0.4,
        sustain: 0.1,
        release: 0.8,
        baseFrequency: 80,
        octaves: 2,
      },
      volume: -4,
    }).toDestination();

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
            (e.velocity / 127) * 0.85
          );
      }),
      makePart(pack.melody, (time, e) => {
        if (!this.mutedVoices.has('melody'))
          this.melodySynth!.triggerAttackRelease(
            Tone.Frequency(e.pitch, 'midi').toNote(),
            Math.max(1, e.duration) * s16,
            time,
            (e.velocity / 127) * 0.9
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
    try { this.reverb?.dispose(); } catch { /* already disposed */ }
    this.chordsSynth = null;
    this.melodySynth = null;
    this.bassSynth = null;
    this.reverb = null;
    this.mutedVoices.clear();
  }
}
