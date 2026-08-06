import { Midi, Track } from "@tonejs/midi";
import { eventsToTrackNotes, MidiEvent } from "./midiEvents";

const PPQ = 500;
const QPM = 120;

// Note times are captured in ms, but Track reads absoluteTime as ticks.
export const TICKS_PER_MS = (PPQ * QPM) / 60000;

/**
 *
 * @param ns
 * @returns
 */
export function trackToMidi(trackData: any) {
  const midi = new Midi();
  midi.fromJSON({
    header: {
      name: "",
      ppq: PPQ,
      tempos: [],
      timeSignatures: [],
      keySignatures: [],
      meta: [],
    },
    tracks: [],
  });

  // Add tempo changes. We need to add them in chronological order, so that we
  // can calculate their times correctly.
  const tempo = { time: 0, qpm: QPM };
  midi.header.tempos.push({
    ticks: midi.header.secondsToTicks(tempo.time),
    bpm: tempo.qpm,
  });
  midi.header.update(); // Update the tempo times for secondsToTicks to work.
  midi.header.timeSignatures.push({ ticks: 0, timeSignature: [4, 4] });
  midi.header.update();

  const tr = new Track(trackData, midi.header);
  midi.tracks.push(tr);

  return midi.toArray();
}

/**
 * Convert a take's captured MIDI messages into MIDI file bytes.
 * `finalisedAt` closes any note still held when the take ended; epoch ms, same
 * clock as the events. Null when the take holds no playable notes.
 */
export function eventsToMidi(
  events: MidiEvent[],
  finalisedAt: number,
): Uint8Array | null {
  const trackNotes = eventsToTrackNotes(events, finalisedAt, TICKS_PER_MS);
  if (trackNotes.length === 0) return null;

  return trackToMidi(trackNotes);
}

// String.fromCharCode(...bytes) blows the argument limit around 125k bytes.
const CHUNK = 8192;

export function encodeMidi(bytes: Uint8Array): string {
  let binary = "";
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode.apply(
      null,
      Array.from(bytes.subarray(i, i + CHUNK)),
    );
  }

  return btoa(binary);
}

export function midiStringToBlob(midiString: string): Blob {
  return new Blob([Uint8Array.from(atob(midiString), (c) => c.charCodeAt(0))]);
}
