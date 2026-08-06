/**
 * Captured WebMIDI messages -> the note events `@tonejs/midi`'s Track consumes.
 * No @magenta/music or @tonejs/midi imports, so this is directly testable.
 */

export interface MidiEvent {
  data: Uint8Array;
  timeStamp: number;
}

export interface TrackNoteEvent {
  type: "noteOn" | "noteOff";
  noteNumber: number;
  velocity: number;
  absoluteTime: number;
}

const STATUS_MASK = 0xf0;
const NOTE_ON = 0x90;
const NOTE_OFF = 0x80;
const SYSTEM = 0xf0;

export function isSystemMessage(status: number): boolean {
  return (status & STATUS_MASK) === SYSTEM;
}

export function isNoteOnMessage(status: number, velocity: number): boolean {
  return (status & STATUS_MASK) === NOTE_ON && velocity > 0;
}

/** Velocity-0 note-on is a note-off (MIDI 1.0); Track does not normalise it. */
export function isNoteOffMessage(status: number, velocity: number): boolean {
  return (
    (status & STATUS_MASK) === NOTE_OFF ||
    ((status & STATUS_MASK) === NOTE_ON && velocity === 0)
  );
}

/**
 * Times are normalised to ticks relative to the first message. Notes still held
 * at `finalisedAt` are closed there — Track silently drops unpaired note-ons.
 *
 * Channel is deliberately not carried onto the events: Track takes its channel
 * from the last note-on and writes every note on it.
 */
export function eventsToTrackNotes(
  events: MidiEvent[],
  finalisedAt: number,
  ticksPerMs: number,
): TrackNoteEvent[] {
  if (events.length === 0) return [];

  const firstTimestamp = events[0].timeStamp;
  const toTicks = (timeStamp: number) =>
    Math.round((timeStamp - firstTimestamp) * ticksPerMs);

  // Count per pitch, not a flag: a retrigger without an intervening note-off
  // would otherwise read as released one note-off early.
  const heldCounts = new Map<number, number>();
  const trackNotes: TrackNoteEvent[] = [];
  let lastTimestamp = firstTimestamp;

  for (const event of events) {
    const data = event.data;
    const status = data[0] ?? 0;
    const noteNumber = data[1] ?? 0;
    const velocity = data[2] ?? 0;

    if (isSystemMessage(status)) continue;

    lastTimestamp = Math.max(lastTimestamp, event.timeStamp);

    if (isNoteOnMessage(status, velocity)) {
      heldCounts.set(noteNumber, (heldCounts.get(noteNumber) ?? 0) + 1);
      trackNotes.push({
        type: "noteOn",
        noteNumber,
        velocity,
        absoluteTime: toTicks(event.timeStamp),
      });
    } else if (isNoteOffMessage(status, velocity)) {
      const held = heldCounts.get(noteNumber) ?? 0;
      if (held > 0) heldCounts.set(noteNumber, held - 1);
      trackNotes.push({
        type: "noteOff",
        noteNumber,
        velocity,
        absoluteTime: toTicks(event.timeStamp),
      });
    }
  }

  // Never close before the last real message, which would invert the duration.
  const boundaryTicks = toTicks(Math.max(finalisedAt, lastTimestamp));

  heldCounts.forEach((count, noteNumber) => {
    for (let i = 0; i < count; i++) {
      trackNotes.push({
        type: "noteOff",
        noteNumber,
        // Explicit: Track computes noteOff.velocity / 127, so absent is NaN.
        velocity: 0,
        absoluteTime: boundaryTicks,
      });
    }
  });

  return trackNotes;
}
