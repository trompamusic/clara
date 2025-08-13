import { Input } from "webmidi";

// MIDI Event types
export interface MidiEvent {
  data: Uint8Array;
  timeStamp: number;
}

// Recording state types
export interface RecordingState {
  isRecording: boolean;
  startTime: number | null;
  elapsedTime: number;
  events: MidiEvent[];
}

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
}
