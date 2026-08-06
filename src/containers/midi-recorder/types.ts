export type { MidiEvent } from "../../util/midiEvents";

import { MidiEvent } from "../../util/midiEvents";

export type RecordingPhase = "idle" | "recording" | "stopped";

// Why a take stopped. Only "deviceChanged" is worth telling the user about:
// the others are what they asked for.
export type StopReason = "silence" | "deviceChanged" | "ended";

// Recording state types
export type RecordingState =
  | { phase: "idle" }
  | {
      phase: "recording";
      startedAt: number;
      lastNoteEventAt: number;
      // The input this take is capturing from. Compared by id, so a reconnect
      // swapping in a fresh Input object is not mistaken for a device change.
      deviceId: string | null;
      heldCounts: Record<number, number>; // per pitch, so retriggers don't undercount
      heldTotal: number;
      events: MidiEvent[];
    }
  // submission countdown, running over a finished take
  | {
      phase: "stopped";
      startedAt: number;
      finalisedAt: number;
      // Absolute, fixed at finalisation: editing metadata must not extend it.
      deadline: number;
      reason: StopReason;
      events: MidiEvent[];
    };

// Upload state types
export interface UploadState {
  isUploading: boolean;
  error: string | null;
}

// Performance data types
export interface PerformanceData {
  midiData: string | null;
  label?: string;
  expansion?: string;
  recordedAt?: string;
}
