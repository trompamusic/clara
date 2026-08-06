import React, { useState, useCallback, useEffect } from "react";
import { useSolidAuth } from "@ldo/solid-react";
import { useNavigate } from "react-router";
import { useLocalStorage } from "usehooks-ts";
import { Input } from "webmidi";
import { Alert, Button, Card } from "react-bootstrap";
import { encodeMidi, eventsToMidi, midiStringToBlob } from "../../util/midi";
import {
  isNoteOffMessage,
  isNoteOnMessage,
  isSystemMessage,
} from "../../util/midiEvents";
import Api from "../../util/api";
import { createPerformanceLabel } from "../../util/date";
import {
  RecordingState,
  PerformanceData,
  StopReason,
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
    phase: "idle",
  });
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    error: null,
  });

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

  const selectedDeviceId = selectedDevice?.id ?? null;

  // Handle MIDI message
  const handleMidiMessage = useCallback(
    (mes: any) => {
      if (!selectedDevice) return;

      const data = mes.data as Uint8Array;
      const status = data[0] ?? 0;

      // Drop system messages (0xF0-0xFF)
      if (isSystemMessage(status)) return;

      const noteNumber = data[1] ?? 0;
      const velocity = data[2] ?? 0;
      const isNoteOn = isNoteOnMessage(status, velocity);
      const isNoteOff = isNoteOffMessage(status, velocity);
      const now = Date.now();
      const deviceId = selectedDevice.id ?? null;

      setRecordingState((prev) => {
        if (prev.phase === "stopped") return prev;
        if (prev.phase === "idle" && !isNoteOn) return prev;

        const prior =
          prev.phase === "recording"
            ? prev
            : {
                startedAt: now,
                lastNoteEventAt: now,
                deviceId,
                heldCounts: {} as Record<number, number>,
                heldTotal: 0,
                events: [],
              };

        let heldCounts = prior.heldCounts;
        let heldTotal = prior.heldTotal;
        if (isNoteOn) {
          heldCounts = {
            ...heldCounts,
            [noteNumber]: (heldCounts[noteNumber] ?? 0) + 1,
          };
          heldTotal += 1;
        } else if (isNoteOff && (heldCounts[noteNumber] ?? 0) > 0) {
          heldCounts = { ...heldCounts, [noteNumber]: heldCounts[noteNumber] - 1 };
          heldTotal -= 1;
        }

        return {
          phase: "recording",
          startedAt: prior.startedAt,
          lastNoteEventAt: isNoteOn || isNoteOff ? now : prior.lastNoteEventAt,
          deviceId: prior.deviceId,
          heldCounts,
          heldTotal,
          events: [...prior.events, { data, timeStamp: now }],
        };
      });
    },
    [selectedDevice],
  );

  // Idempotent: three things can end a take, and two of them can land in the
  // same tick. A second call must not move the deadline or rewrite the reason.
  const finaliseTake = useCallback((reason: StopReason) => {
    const now = Date.now();
    setRecordingState((prev) =>
      prev.phase === "recording"
        ? {
            phase: "stopped",
            startedAt: prev.startedAt,
            finalisedAt: now,
            deadline: now + MIDI_TIMEOUT,
            reason,
            events: prev.events,
          }
        : prev,
    );
  }, []);

  // The take ends MIDI_TIMEOUT after the last note event, but only once every
  // key is up, so a sustained chord does not finalise mid-chord. A held key
  // sends nothing on the wire, so note events alone cannot tell "still
  // holding" from "finished".
  useEffect(() => {
    if (recordingState.phase !== "recording") return;
    if (recordingState.heldTotal > 0) return;

    const due = MIDI_TIMEOUT - (Date.now() - recordingState.lastNoteEventAt);
    const timer = setTimeout(() => finaliseTake("silence"), Math.max(0, due));

    return () => clearTimeout(timer);
  }, [recordingState, finaliseTake]);

  // Losing the device we were capturing from ends the take: no further notes
  // can arrive, and a note-off in flight never will, which would otherwise
  // leave the held-note gate shut forever. Covers disconnect, deselection and
  // switching, since all three change the selected id.
  useEffect(() => {
    if (recordingState.phase !== "recording") return;
    if (recordingState.deviceId === selectedDeviceId) return;

    finaliseTake("deviceChanged");
  }, [recordingState, selectedDeviceId, finaliseTake]);

  const handleEndTake = useCallback(() => {
    finaliseTake("ended");
  }, [finaliseTake]);

  // Handle recording timeout
  const handleRecordingTimeout = useCallback(() => {
    if (recordingState.phase !== "stopped") return;

    const midi = eventsToMidi(recordingState.events, recordingState.finalisedAt);

    if (midi) {
      const recordedAt = new Date(recordingState.startedAt).toISOString();
      setMidiPerformance({ midiData: encodeMidi(midi), recordedAt });

      // Auto-upload
      Api.alignMidi(
        webId,
        score,
        new Blob([midi]),
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

    setRecordingState({ phase: "idle" });
  }, [recordingState, setMidiPerformance, webId, score, navigate]);

  // The submission countdown lives here, beside the other timer: it triggers an
  // upload, so it must not be tied to anything that can unmount.
  useEffect(() => {
    if (recordingState.phase !== "stopped") return;

    const due = recordingState.deadline - Date.now();
    const timer = setTimeout(handleRecordingTimeout, Math.max(0, due));

    return () => clearTimeout(timer);
  }, [recordingState, handleRecordingTimeout]);

  // Handle stopping submission timer
  const handleStopSubmission = useCallback(() => {
    if (recordingState.phase !== "stopped") return;

    const midi = eventsToMidi(recordingState.events, recordingState.finalisedAt);
    if (midi) {
      setMidiPerformance({
        midiData: encodeMidi(midi),
        recordedAt: new Date(recordingState.startedAt).toISOString(),
      });
    }

    setRecordingState({ phase: "idle" });
  }, [recordingState, setMidiPerformance]);

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
        setRecordingState({ phase: "idle" });

        navigate(`/uploadwait?task=${result.task_id}&score=${score}`);
      } catch (err) {
        console.error("Manual upload failed:", err);
        setUploadState({
          isUploading: false,
          error: "Failed to upload performance. Please try again.",
        });
      }
    },
    [navigate, score, webId, setMidiPerformance],
  );

  // Discard performance handler
  const handleDiscardPerformance = useCallback(() => {
    setMidiPerformance(null);
    setUploadState({ isUploading: false, error: null });

    setRecordingState({ phase: "idle" });
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
  }, [storedPerformance, webId, score, navigate, setMidiPerformance]);

  // Delete saved recording handler
  const handleDeleteSavedRecording = useCallback(() => {
    setMidiPerformance(null);
  }, [setMidiPerformance]);

  const takeStartedAt =
    recordingState.phase === "idle" ? null : recordingState.startedAt;
  const hasTakeEvents =
    recordingState.phase !== "idle" && recordingState.events.length > 0;

  return (
    <div id="authWrapper">
      <div id="midi">
        {/* MIDI Device Management */}
        <MidiDeviceManager
          onDeviceSelect={setSelectedDevice}
          onMidiMessage={handleMidiMessage}
          selectedDevice={selectedDevice}
        />

        {/* Take status. A sibling of the device panel, not a child of it: it
            drives the submission countdown, which must survive a device
            going away. */}
        <RecordingTimer
          phase={recordingState.phase}
          startedAt={takeStartedAt}
          deadline={
            recordingState.phase === "stopped" ? recordingState.deadline : null
          }
          onEndTake={handleEndTake}
          onStopSubmission={handleStopSubmission}
        />

        {recordingState.phase === "stopped" &&
          recordingState.reason === "deviceChanged" && (
            <Alert variant="warning" className="mt-2 py-2 small">
              Your MIDI device changed, so the recording was finished.
            </Alert>
          )}

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

        {hasTakeEvents || storedPerformance ? (
          <PerformanceUploader
            performanceData={{
              midiData: storedPerformance?.midiData ?? null,
              recordedAt:
                storedPerformance?.recordedAt ??
                (takeStartedAt
                  ? new Date(takeStartedAt).toISOString()
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
