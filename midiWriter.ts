import MidiWriter from "midi-writer-js";

type NoteEvent = {
  pitch: string;
  duration: string;
  velocity?: number;
};

export function buildMidiTrack(
  trackName: string,
  notes: NoteEvent[],
  bpm: number
) {
  const track = new MidiWriter.Track();

  track.setTempo(bpm);
  track.addTrackName(trackName);

  notes.forEach((note) => {
    track.addEvent(
      new MidiWriter.NoteEvent({
        pitch: [note.pitch],
        duration: note.duration,
        velocity: note.velocity ?? 90
      })
    );
  });

  return new MidiWriter.Writer(track).buildFile();
}
