import React, { useState, useCallback, useRef, useEffect } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { useNavigate } from "react-router";
import { useLocalStorage } from "usehooks-ts";
import { Input } from "webmidi";
import { Button, Card } from "react-bootstrap";
import { trackToMidi } from "../../util/midi";
import Api from "../../util/api";
import { createPerformanceLabel } from "../../util/date";
import {
  MidiEvent,
  RecordingState,
  PerformanceData,
  UploadState,
} from "./types";
import MidiDeviceManager from "./MidiDeviceManager";
import RecordingTimer from "./RecordingTimer";
import PerformanceUploader from "./PerformanceUploader";

const MIDI_TIMEOUT = 5000;

const WebMidiRecorder: React.FC<{
  score: string;
  expansionOptions: string[];
}> = ({ score, expansionOptions }) => {
  const { session } = useSolidAuth();
  const webId = session.webId ?? "";
  const navigate = useNavigate();

  // State
  const [selectedDevice, setSelectedDevice] = useState<Input | null>(null);
  const [recordingState, setRecordingState] = useState<RecordingState>({
    isRecording: false,
    startTime: null,
    elapsedTime: 0,
    events: [],
  });
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    error: null,
  });
  const [noteEventCount, setNoteEventCount] = useState(0);

  // Refs
  const timerRef = useRef<NodeJS.Timeout>();

  // Local storage
  const localStorageKey = `at.ac.mdw.trompa-midiPerformance-${webId}-${score}`;
  type StoredPerformance = {
    midiData: string;
    recordedAt: string;
  };

  const [midiPerformance, setMidiPerformance] = useLocalStorage<
    StoredPerformance | string | null
  >(localStorageKey, null);
  const storedPerformance =
    typeof midiPerformance === "string" ? null : midiPerformance;

  useEffect(() => {
    if (typeof midiPerformance === "string") {
      setMidiPerformance({
        midiData: midiPerformance,
        recordedAt: new Date().toISOString(),
      });
    }
  }, [midiPerformance, setMidiPerformance]);

  // Convert MIDI string to Blob for API calls
  const midiStringToBlob = useCallback((midiString: string): Blob => {
    const midiArray = midiString.split(",").map((s) => parseInt(s));
    const midi = new Uint8Array(midiArray);
    return new Blob([midi]);
  }, []);

  // Convert MIDI events to MIDI file
  const midiEventsArrayToMidiFile = useCallback((events: MidiEvent[]) => {
    if (events.length === 0) return null;

    const firstTimestamp = events[0].timeStamp;
    const trackNotes = events
      .map((e) => {
        const timeStamp = e.timeStamp - firstTimestamp;
        const d = e.data;

        if (d[0] === 144) {
          return {
            type: "noteOn",
            noteNumber: d[1],
            velocity: d[2],
            absoluteTime: timeStamp,
          } as any;
        } else if (d[0] === 128) {
          return {
            type: "noteOff",
            noteNumber: d[1],
            velocity: d[2],
            absoluteTime: timeStamp,
          } as any;
        }
        return null;
      })
      .filter((e): e is NonNullable<typeof e> => e !== null);

    return trackToMidi(trackNotes);
  }, []);

  // Handle MIDI message
  const handleMidiMessage = useCallback(
    (mes: any) => {
      if (!selectedDevice) return;

      const dataArray = Array.from(mes.data);
      const status = (dataArray[0] as number) ?? 0;
      const velocity = (dataArray[2] as number) ?? 0;
      const isNoteOn = status >= 0x90 && status <= 0x9f && velocity > 0;
      const isNoteOff =
        (status >= 0x80 && status <= 0x8f) ||
        (status >= 0x90 && status <= 0x9f && velocity === 0);
      const isNoteEvent = isNoteOn || isNoteOff;
      const now = Date.now();
      let noteEventRecorded = false;

      setRecordingState((prev) => {
        if (!prev.isRecording && !isNoteOn) {
          return prev;
        }

        if (!prev.isRecording && isNoteOn) {
          noteEventRecorded = true;
          return {
            ...prev,
            isRecording: true,
            startTime: now,
            elapsedTime: 0,
            events: [...prev.events, { data: mes.data, timeStamp: now }],
          };
        }

        if (prev.isRecording) {
          if (isNoteEvent) {
            noteEventRecorded = true;
          }
          return {
            ...prev,
            events: [...prev.events, { data: mes.data, timeStamp: now }],
          };
        }

        return prev;
      });

      if (noteEventRecorded) {
        setNoteEventCount((prev) => prev + 1);
      }
    },
    [selectedDevice],
  );

  // Update elapsed time while recording
  useEffect(() => {
    let interval: NodeJS.Timeout;

    if (recordingState.isRecording && recordingState.startTime) {
      interval = setInterval(() => {
        const newElapsedTime = Date.now() - (recordingState.startTime || 0);
        setRecordingState((prev) => ({
          ...prev,
          elapsedTime: newElapsedTime,
        }));
      }, 100); // Update every 100ms for smooth display
    }

    return () => {
      if (interval) clearInterval(interval);
    };
  }, [recordingState.isRecording, recordingState.startTime]);

  // Handle recording timeout
  const handleRecordingTimeout = useCallback(() => {
    if (recordingState.events.length > 0) {
      const midi = midiEventsArrayToMidiFile(recordingState.events);

      if (midi) {
        const midiString = midi.toString();
        const recordedAt = new Date(
          recordingState.startTime ?? Date.now(),
        ).toISOString();
        setMidiPerformance({ midiData: midiString, recordedAt });

        // Auto-upload
        const payload = midiStringToBlob(midiString);
        Api.alignMidi(
          webId,
          score,
          payload,
          createPerformanceLabel(new Date(recordedAt)),
          "no expansion",
        )
          .then((data) => {
            setMidiPerformance(null);
            navigate(`/uploadwait?task=${data.task_id}&score=${score}`);
          })
          .catch((err) => {
            console.error("Upload failed:", err);
            setUploadState({
              isUploading: false,
              error: "Failed to upload performance. Please try again.",
            });
          });
      }

      setRecordingState((prev) => ({
        ...prev,
        events: [],
        isRecording: false,
        startTime: null,
        elapsedTime: 0, // Reset after submission
      }));
    }
  }, [
    recordingState.events,
    recordingState.startTime,
    midiEventsArrayToMidiFile,
    setMidiPerformance,
    webId,
    score,
    navigate,
    midiStringToBlob,
  ]);

  // Handle stopping submission timer
  const handleStopSubmission = useCallback(() => {
    // Clear the submission timer
    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    // Convert current recording events to MIDI data for editing
    if (recordingState.events.length > 0) {
      const midi = midiEventsArrayToMidiFile(recordingState.events);
      if (midi) {
        const midiString = midi.toString();
        const recordedAt = new Date(
          recordingState.startTime ?? Date.now(),
        ).toISOString();
        setMidiPerformance({ midiData: midiString, recordedAt });
      }
    }

    // Keep the current recording events but stop the submission timer
    // User can continue recording or manually submit later
    setRecordingState((prev) => ({
      ...prev,
      isRecording: false,
      startTime: null,
      // Keep elapsed time in case user wants to continue recording
    }));
  }, [
    recordingState.events,
    recordingState.startTime,
    midiEventsArrayToMidiFile,
    setMidiPerformance,
  ]);

  // Handle recording state when no events for a while
  useEffect(() => {
    if (recordingState.events.length === 0 && recordingState.isRecording) {
      // If we have no events but are still recording, wait a bit then stop
      const stopRecordingTimer = setTimeout(() => {
        if (recordingState.events.length === 0) {
          setRecordingState((prev) => ({
            ...prev,
            isRecording: false,
            startTime: null,
            // Keep elapsed time for countdown
          }));
        }
      }, 2000); // Wait 2 seconds after last event before stopping recording

      return () => clearTimeout(stopRecordingTimer);
    }
  }, [recordingState.events, recordingState.isRecording]);

  // Handle MIDI events timeout - this should only detect when recording stops, not submit
  useEffect(() => {
    if (noteEventCount === 0) {
      return;
    }

    if (timerRef.current) {
      clearTimeout(timerRef.current);
    }

    timerRef.current = setTimeout(() => {
      setRecordingState((prev) => ({
        ...prev,
        isRecording: false,
        startTime: null,
        // Don't reset elapsedTime here - keep it for the countdown
      }));
    }, MIDI_TIMEOUT);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [noteEventCount]);

  // Manual upload handler
  const handleManualUpload = useCallback(
    async (data: PerformanceData) => {
      if (!data.midiData) return;

      try {
        setUploadState({ isUploading: true, error: null });

        const payload = midiStringToBlob(data.midiData);

        // Pass label and expansion to the API
        const result = await Api.alignMidi(
          webId,
          score,
          payload,
          data.label ||
            createPerformanceLabel(
              data.recordedAt ? new Date(data.recordedAt) : new Date(),
            ),
          data.expansion,
        );
        setMidiPerformance(null);

        // Clear recording state after successful upload
        setRecordingState((prev) => ({
          ...prev,
          events: [],
          isRecording: false,
          startTime: null,
          elapsedTime: 0,
        }));

        navigate(`/uploadwait?task=${result.task_id}&score=${score}`);
      } catch (err) {
        console.error("Manual upload failed:", err);
        setUploadState({
          isUploading: false,
          error: "Failed to upload performance. Please try again.",
        });
      }
    },
    [navigate, score, webId, setMidiPerformance, midiStringToBlob],
  );

  // Discard performance handler
  const handleDiscardPerformance = useCallback(() => {
    setMidiPerformance(null);
    setUploadState({ isUploading: false, error: null });

    // Clear recording state
    setRecordingState((prev) => ({
      ...prev,
      events: [],
      isRecording: false,
      startTime: null,
      elapsedTime: 0,
    }));
  }, [setMidiPerformance]);

  // Upload saved recording handler
  const handleUploadSavedRecording = useCallback(async () => {
    if (!storedPerformance) return;

    try {
      setUploadState({ isUploading: true, error: null });
      const payload = midiStringToBlob(storedPerformance.midiData);
      const data = await Api.alignMidi(
        webId,
        score,
        payload,
        createPerformanceLabel(new Date(storedPerformance.recordedAt)),
        "no expansion",
      );
      setMidiPerformance(null);
      navigate(`/uploadwait?task=${data.task_id}&score=${score}`);
    } catch (err) {
      console.error("Upload failed:", err);
      setUploadState({
        isUploading: false,
        error: "Failed to upload existing performance. Please try again.",
      });
    }
  }, [
    storedPerformance,
    webId,
    score,
    navigate,
    setMidiPerformance,
    midiStringToBlob,
  ]);

  // Delete saved recording handler
  const handleDeleteSavedRecording = useCallback(() => {
    setMidiPerformance(null);
  }, [setMidiPerformance]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, []);

  return (
    <div id="authWrapper">
      <div id="midi">
        {/* MIDI Device Management */}
        <MidiDeviceManager
          onDeviceSelect={setSelectedDevice}
          onMidiMessage={handleMidiMessage}
          selectedDevice={selectedDevice}
          recordingStatus={
            <RecordingTimer
              isRecording={recordingState.isRecording}
              elapsedTime={recordingState.elapsedTime}
              onTimeout={handleRecordingTimeout}
              onStopSubmission={handleStopSubmission}
              timeoutDuration={MIDI_TIMEOUT}
            />
          }
        />

        {/* Saved Recording - always shown if exists */}
        {storedPerformance && (
          <Card className="mt-3 border-warning">
            <Card.Header className="bg-warning bg-opacity-10">
              <h6 className="mb-0 text-warning">💾 Saved Recording</h6>
            </Card.Header>
            <Card.Body>
              <p className="text-muted small mb-3">
                You have a saved performance which wasn't uploaded. You can
                submit it again. If you start a new performance this one will be
                deleted.
              </p>
              <div className="d-flex gap-2">
                <Button
                  onClick={handleUploadSavedRecording}
                  variant="primary"
                  size="sm"
                >
                  Upload Recording
                </Button>
                <Button
                  onClick={handleDeleteSavedRecording}
                  variant="outline-danger"
                  size="sm"
                >
                  Delete Recording
                </Button>
              </div>
            </Card.Body>
          </Card>
        )}

        {recordingState.events.length > 0 || storedPerformance ? (
          <PerformanceUploader
            performanceData={{
              midiData: storedPerformance?.midiData ?? null,
              recordedAt:
                storedPerformance?.recordedAt ??
                (recordingState.startTime
                  ? new Date(recordingState.startTime).toISOString()
                  : undefined),
            }}
            onUpload={handleManualUpload}
            onDiscard={handleDiscardPerformance}
            uploadState={uploadState}
            expansionOptions={expansionOptions}
          />
        ) : null}
      </div>
    </div>
  );
};

export default WebMidiRecorder;
