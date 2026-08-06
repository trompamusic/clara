import { MidiEvent } from "../../util/midiEvents";

export type StopReason = "silence" | "deviceChanged";

export interface Recording {
  phase: "recording";
  startedAt: number;
  lastNoteEventAt: number;
  deviceId: string;
  heldCounts: Record<number, number>;
  heldTotal: number;
  events: MidiEvent[];
}

export interface StoredPerformance {
  midiData: string;
  recordedAt: string;
}

export interface Metadata {
  label: string;
  expansion: string;
}

export interface TakeDraft extends Metadata {
  kind: "take";
  take: StoredPerformance;
  recovered: boolean;
}

export interface FileDraft extends Metadata {
  kind: "file";
  // Distinguishes a reopened panel from an abandoned file selection.
  session: symbol;
}

export type Workflow =
  | { phase: "ready" }
  | Recording
  | {
      phase: "takeCountdown";
      draft: TakeDraft;
      deadline: number;
      reason: StopReason;
    }
  | {
      phase: "takeReview";
      draft: TakeDraft;
      error: string | null;
      confirmingDiscard: boolean;
    }
  | { phase: "fileSelect"; draft: FileDraft; error: string | null }
  | { phase: "uploading"; draft: TakeDraft | FileDraft };
